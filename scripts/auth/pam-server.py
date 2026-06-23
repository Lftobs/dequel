#!/usr/bin/env python3
"""HTTP sidecar for PAM authentication. Replaces direct /etc/shadow access from the API container."""
import json
import os
import ctypes
import ctypes.util
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

GRP_NAME = "dequel"
SERVICE = "dequel"

PAM_PROMPT_ECHO_OFF = 1
PAM_SUCCESS = 0
PAM_END = -1


class PamMessage(ctypes.Structure):
    _fields_ = [("msg_style", ctypes.c_int), ("msg", ctypes.c_char_p)]


class PamResponse(ctypes.Structure):
    _fields_ = [("resp", ctypes.c_void_p), ("resp_retcode", ctypes.c_int)]


CONV_FUNC = ctypes.CFUNCTYPE(
    ctypes.c_int,
    ctypes.c_int,
    ctypes.POINTER(ctypes.POINTER(PamMessage)),
    ctypes.POINTER(ctypes.c_void_p),
    ctypes.c_void_p,
)


class PamConv(ctypes.Structure):
    _fields_ = [("conv", CONV_FUNC), ("appdata_ptr", ctypes.c_void_p)]


def verify(username: str, password: str) -> dict:
    lib_path = ctypes.util.find_library("pam")
    if not lib_path:
        return {"ok": False, "error": "PAM library not found on system"}
    libpam = ctypes.cdll.LoadLibrary(lib_path)
    libc = ctypes.cdll.LoadLibrary("libc.so.6")
    libpam.pam_start.restype = ctypes.c_int
    libpam.pam_authenticate.restype = ctypes.c_int
    libpam.pam_acct_mgmt.restype = ctypes.c_int
    libpam.pam_end.restype = ctypes.c_int
    libpam.pam_strerror.restype = ctypes.c_char_p
    libpam.pam_strerror.argtypes = [ctypes.c_void_p, ctypes.c_int]

    password_cpy = [password]

    def conv(nmsg, msg, out_resp, appdata):
        count = nmsg
        resp_size = ctypes.sizeof(PamResponse) * count
        buf = libc.malloc(resp_size)
        ctypes.memset(buf, 0, resp_size)
        arr = ctypes.cast(buf, ctypes.POINTER(PamResponse))
        for i in range(count):
            pm = ctypes.cast(msg[i], ctypes.POINTER(PamMessage))[0]
            if pm.msg_style == PAM_PROMPT_ECHO_OFF:
                pw = password_cpy[0]
                pw_buf = libc.strdup(pw.encode())
                arr[i].resp = pw_buf
                arr[i].resp_retcode = 0
            else:
                arr[i].resp = None
                arr[i].resp_retcode = PAM_END
        out_resp[0] = buf
        return PAM_SUCCESS

    cb = CONV_FUNC(conv)
    conv_struct = PamConv(cb, None)
    handle = ctypes.c_void_p()

    ret = libpam.pam_start(SERVICE.encode(), username.encode(), ctypes.byref(conv_struct), ctypes.byref(handle))
    if ret != PAM_SUCCESS:
        err = libpam.pam_strerror(handle, ret)
        return {"ok": False, "error": f"PAM start failed: {(err or b'').decode()}"}

    ret = libpam.pam_authenticate(handle, 0)
    if ret != PAM_SUCCESS:
        libpam.pam_end(handle, ret)
        return {"ok": False, "error": "Authentication failed"}

    ret = libpam.pam_acct_mgmt(handle, 0)
    libpam.pam_end(handle, ret)
    if ret != PAM_SUCCESS:
        return {"ok": False, "error": "Account expired or disabled"}

    result = subprocess.run(
        ["getent", "group", GRP_NAME],
        capture_output=True, text=True, timeout=10,
    )
    if result.returncode != 0:
        return {"ok": False, "error": f"Group '{GRP_NAME}' does not exist"}

    group_parts = result.stdout.strip().split(":")
    members = group_parts[-1].split(",") if len(group_parts) >= 4 else []
    gid = group_parts[2] if len(group_parts) >= 3 else None

    if username in members:
        return {"ok": True, "username": username}

    if gid:
        pw_result = subprocess.run(
            ["getent", "passwd", username],
            capture_output=True, text=True, timeout=10,
        )
        if pw_result.returncode == 0:
            user_gid = pw_result.stdout.strip().split(":")[3] if ":" in pw_result.stdout else None
            if user_gid == gid:
                return {"ok": True, "username": username}

    return {"ok": False, "error": f"User '{username}' is not in the '{GRP_NAME}' group"}


class PamHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode())
            return

        username = data.get("username", "").strip()
        password = data.get("password", "")

        if not username or not password:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Username and password required"}).encode())
            return

        result = verify(username, password)
        status = 200 if result.get("ok") else 401
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode())
            return
        self.send_response(404)
        self.end_headers()


def main():
    port = int(os.environ.get("PORT", "4567"))
    server = HTTPServer(("0.0.0.0", port), PamHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
