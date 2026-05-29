import { describe, it, expect, beforeAll, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';

const db = new Database(':memory:');

db.run(`
  CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('custom', 'base')),
    validation_status TEXT NOT NULL DEFAULT 'pending',
    ssl_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const testRepo = {
  createDomain: (input: { projectId: string; domain: string; type: string }) => {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    db.run(
      'INSERT INTO domains (id, project_id, domain, type, validation_status, ssl_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, input.projectId, input.domain, input.type, 'pending', 'pending', timestamp, timestamp
    );
    const row = db.query('SELECT * FROM domains WHERE id = ?').get(id) as any;
    return {
      id: row.id,
      projectId: row.project_id,
      domain: row.domain,
      type: row.type,
      validationStatus: row.validation_status,
      sslStatus: row.ssl_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
  listDomains: (projectId: string) => {
    const rows = db.query('SELECT * FROM domains WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      domain: r.domain,
      type: r.type,
      validationStatus: r.validation_status,
      sslStatus: r.ssl_status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },
  getDomainById: (id: string) => {
    const row = db.query('SELECT * FROM domains WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      domain: row.domain,
      type: row.type,
      validationStatus: row.validation_status,
      sslStatus: row.ssl_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
  updateDomainValidation: (id: string, validationStatus: string, sslStatus?: string) => {
    db.run(
      'UPDATE domains SET validation_status = ?, ssl_status = COALESCE(?, ssl_status), updated_at = ? WHERE id = ?',
      validationStatus, sslStatus ?? null, new Date().toISOString(), id
    );
  },
  updateDomainSslStatus: (id: string, sslStatus: string) => {
    db.run('UPDATE domains SET ssl_status = ?, updated_at = ? WHERE id = ?', sslStatus, new Date().toISOString(), id);
  },
  deleteDomain: (id: string) => {
    const result = db.run('DELETE FROM domains WHERE id = ?', id);
    return result.changes > 0;
  },
};

describe('Domain CRUD', () => {
  afterEach(() => {
    db.run('DELETE FROM domains');
  });

  describe('createDomain', () => {
    it('creates a domain with pending status', () => {
      const domain = testRepo.createDomain({ projectId: 'proj-1', domain: 'app.example.com', type: 'custom' });
      expect(domain.id).toBeDefined();
      expect(domain.projectId).toBe('proj-1');
      expect(domain.domain).toBe('app.example.com');
      expect(domain.type).toBe('custom');
      expect(domain.validationStatus).toBe('pending');
      expect(domain.sslStatus).toBe('pending');
      expect(domain.createdAt).toBeDefined();
      expect(domain.updatedAt).toBeDefined();
    });

    it('creates a base domain', () => {
      const domain = testRepo.createDomain({ projectId: 'proj-1', domain: 'example.com', type: 'base' });
      expect(domain.type).toBe('base');
    });
  });

  describe('listDomains', () => {
    it('lists domains for a project ordered by created_at desc', async () => {
      testRepo.createDomain({ projectId: 'proj-1', domain: 'first.com', type: 'custom' });
      await Bun.sleep(2);
      testRepo.createDomain({ projectId: 'proj-1', domain: 'second.com', type: 'custom' });
      testRepo.createDomain({ projectId: 'proj-2', domain: 'other.com', type: 'custom' });

      const domains = testRepo.listDomains('proj-1');
      expect(domains).toHaveLength(2);
      expect(domains[0].domain).toBe('second.com');
      expect(domains[1].domain).toBe('first.com');
    });

    it('returns empty list when no domains exist', () => {
      const domains = testRepo.listDomains('nonexistent');
      expect(domains).toEqual([]);
    });
  });

  describe('getDomainById', () => {
    it('returns domain by id', () => {
      const created = testRepo.createDomain({ projectId: 'proj-1', domain: 'app.example.com', type: 'custom' });
      const found = testRepo.getDomainById(created.id);
      expect(found).toEqual(created);
    });

    it('returns null for nonexistent id', () => {
      expect(testRepo.getDomainById('nonexistent')).toBeNull();
    });
  });

  describe('updateDomainValidation', () => {
    it('updates validation status', () => {
      const domain = testRepo.createDomain({ projectId: 'proj-1', domain: 'app.example.com', type: 'custom' });
      testRepo.updateDomainValidation(domain.id, 'verified', 'provisioned');
      const updated = testRepo.getDomainById(domain.id)!;
      expect(updated.validationStatus).toBe('verified');
      expect(updated.sslStatus).toBe('provisioned');
    });

    it('does not overwrite ssl status when not provided', () => {
      const domain = testRepo.createDomain({ projectId: 'proj-1', domain: 'app.example.com', type: 'custom' });
      testRepo.updateDomainValidation(domain.id, 'failed');
      const updated = testRepo.getDomainById(domain.id)!;
      expect(updated.validationStatus).toBe('failed');
      expect(updated.sslStatus).toBe('pending');
    });

    it('updates the updated_at timestamp', () => {
      const domain = testRepo.createDomain({ projectId: 'proj-1', domain: 'app.example.com', type: 'custom' });
      const before = new Date(domain.updatedAt).getTime();
      // Wait 1ms
      const start = Date.now();
      while (Date.now() - start < 2) {}
      testRepo.updateDomainValidation(domain.id, 'verified');
      const updated = testRepo.getDomainById(domain.id)!;
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(before);
    });
  });

  describe('updateDomainSslStatus', () => {
    it('updates only ssl status', () => {
      const domain = testRepo.createDomain({ projectId: 'proj-1', domain: 'app.example.com', type: 'custom' });
      testRepo.updateDomainSslStatus(domain.id, 'provisioned');
      const updated = testRepo.getDomainById(domain.id)!;
      expect(updated.sslStatus).toBe('provisioned');
      expect(updated.validationStatus).toBe('pending');
    });
  });

  describe('deleteDomain', () => {
    it('deletes a domain and returns true', () => {
      const domain = testRepo.createDomain({ projectId: 'proj-1', domain: 'app.example.com', type: 'custom' });
      const result = testRepo.deleteDomain(domain.id);
      expect(result).toBe(true);
      expect(testRepo.getDomainById(domain.id)).toBeNull();
    });

    it('returns false for nonexistent id', () => {
      const result = testRepo.deleteDomain('nonexistent');
      expect(result).toBe(false);
    });

    it('does not affect other domains', () => {
      const d1 = testRepo.createDomain({ projectId: 'proj-1', domain: 'first.com', type: 'custom' });
      const d2 = testRepo.createDomain({ projectId: 'proj-1', domain: 'second.com', type: 'custom' });
      testRepo.deleteDomain(d1.id);
      expect(testRepo.listDomains('proj-1')).toHaveLength(1);
      expect(testRepo.listDomains('proj-1')[0].domain).toBe('second.com');
    });
  });

  describe('constraints', () => {
    it('enforces type constraint', () => {
      expect(() => {
        db.run(
          'INSERT INTO domains (id, project_id, domain, type, validation_status, ssl_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          'x', 'proj-1', 'test.com', 'invalid', 'pending', 'pending', new Date().toISOString(), new Date().toISOString()
        );
      }).toThrow();
    });

    it('generates unique ids', () => {
      const d1 = testRepo.createDomain({ projectId: 'proj-1', domain: 'first.com', type: 'custom' });
      const d2 = testRepo.createDomain({ projectId: 'proj-1', domain: 'second.com', type: 'custom' });
      expect(d1.id).not.toBe(d2.id);
    });
  });
});
