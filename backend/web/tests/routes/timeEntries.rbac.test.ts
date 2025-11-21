/**
 * Time Entries RBAC Tests
 * Tests route-level permission enforcement for time entries endpoints
 */

import request from 'supertest';
import { app } from '../../src/server';
import { generateTestToken, TEST_USERS } from '../helpers/auth';

describe('Time Entries RBAC', () => {
  describe('GET /api/time-management/entries', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/time-management/entries')
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/token|authentication/i);
    });

    it('should return 403 without time_tracking.list permission', async () => {
      // Use production_staff user who doesn't have time_tracking.list permission
      const token = generateTestToken(TEST_USERS.production_staff);

      const res = await request(app)
        .get('/api/time-management/entries')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/permission/i);
    });

    it('should return 200 with time_tracking.list permission', async () => {
      // Use manager user who has time_tracking.list permission
      const token = generateTestToken(TEST_USERS.manager);

      const res = await request(app)
        .get('/api/time-management/entries')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Should return entries array or proper response structure
      expect(res.body).toBeDefined();
    });
  });

  describe('POST /api/time-management/entries', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/time-management/entries')
        .send({
          user_id: 1,
          clock_in: '2025-01-01 09:00:00',
          clock_out: '2025-01-01 17:00:00'
        })
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 403 without time_tracking.create permission', async () => {
      const token = generateTestToken(TEST_USERS.production_staff);

      const res = await request(app)
        .post('/api/time-management/entries')
        .set('Authorization', `Bearer ${token}`)
        .send({
          user_id: 1,
          clock_in: '2025-01-01 09:00:00',
          clock_out: '2025-01-01 17:00:00'
        })
        .expect(403);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/permission/i);
    });
  });

  describe('PUT /api/time-management/entries/:entryId', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .put('/api/time-management/entries/1')
        .send({
          clock_in: '2025-01-01 09:00:00',
          clock_out: '2025-01-01 17:00:00'
        })
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 403 without time_tracking.update permission', async () => {
      const token = generateTestToken(TEST_USERS.production_staff);

      const res = await request(app)
        .put('/api/time-management/entries/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clock_in: '2025-01-01 09:00:00',
          clock_out: '2025-01-01 17:00:00'
        })
        .expect(403);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/permission/i);
    });
  });

  describe('DELETE /api/time-management/entries/:entryId', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .delete('/api/time-management/entries/1')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 403 without time_tracking.update permission', async () => {
      const token = generateTestToken(TEST_USERS.production_staff);

      const res = await request(app)
        .delete('/api/time-management/entries/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/permission/i);
    });
  });
});
