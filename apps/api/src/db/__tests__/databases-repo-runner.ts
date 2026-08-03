import { rmSync } from 'node:fs';

const dbPath = process.env.DATABASE_PATH ?? `/tmp/dequel-repo-test-${Date.now()}.db`;

const { migrate } = await import('../migrate');
const { createDatabase, listAllDatabases, listDatabases, getDatabaseById, updateDatabaseStatus, updateDatabaseRuntime, deleteDatabase } = await import('../repo');

try {
  await migrate();
  const standalone = await createDatabase({ name: 'orders', type: 'postgresql', version: '16' });
  const attached = await createDatabase({
    name: 'internal',
    type: 'mysql',
    projectId: 'proj-1',
    publicAccess: false,
    allowedCidrs: ['10.0.0.0/8'],
  });
  await updateDatabaseStatus(standalone.id, 'running', 'db-container-1');
  await updateDatabaseRuntime(standalone.id, { externalPort: 30123, proxyContainerName: 'db-container-1-public', storageUsedMb: 256 });
  const updated = await getDatabaseById(standalone.id);
  console.log(JSON.stringify({
    standalone: {
      projectId: standalone.projectId,
      internalPort: standalone.internalPort,
      status: standalone.status,
      publicAccess: standalone.publicAccess,
      allowAnywhere: standalone.allowPublicAccessFromAnywhere,
      volumeName: standalone.volumeName,
      connectionPrefix: standalone.connectionString.slice(0, 11),
      hasPassword: standalone.password.length > 0,
    },
    attached: {
      projectId: attached.projectId,
      publicAccess: attached.publicAccess,
      allowedCidrs: attached.allowedCidrs,
      projectListCount: (await listDatabases('proj-1')).length,
    },
    updated: {
      status: updated?.status,
      containerName: updated?.containerName,
      externalPort: updated?.externalPort,
      proxyContainerName: updated?.proxyContainerName,
      storageUsedMb: updated?.storageUsedMb,
    },
    deleted: await deleteDatabase(attached.id),
    total: (await listAllDatabases()).length,
  }));
} finally {
  rmSync(dbPath, { force: true });
}
