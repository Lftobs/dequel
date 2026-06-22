#!/usr/bin/env python3
"""Authenticate a Linux user via PAM and check dequel group membership.

Reads JSON { username, password } from stdin.
Exits 0 with { "ok": true, "username": "..." } on success.
Exits 1 with { "ok": false, "error": "..." } on failure.
"""
import json
import sys
import ctypes
import ctypes.util
import subprocess

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
    libpam = ctypes.cdll.LoadLibrary(ctypes.util.find_library("pam"))
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

    members = result.stdout.strip().split(":")[-1].split(",") if ":" in result.stdout else []
    if username not in members:
        return {"ok": False, "error": f"User '{username}' is not in the '{GRP_NAME}' group"}

    return {"ok": True, "username": username}


def main():
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid input: {e}"}))
        sys.exit(1)

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        print(json.dumps({"ok": False, "error": "Username and password required"}))
        sys.exit(1)

    result = verify(username, password)
    print(json.dumps(result))
    sys.exit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
