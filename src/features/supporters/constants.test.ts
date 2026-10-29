import { describe, expect, it } from 'vitest';
import * as server from '../../../api/lib/supporters.js';
import {
  MAX_DISPLAY_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  SUPPORTER_DEPARTMENT_COUNT,
  isSupporterDepartment,
} from './constants';

describe('supporter constants', () => {
  it('mirror the server values they must stay in lockstep with', () => {
    expect(MAX_DISPLAY_NAME_LENGTH).toBe(server.MAX_DISPLAY_NAME_LENGTH);
    expect(MAX_MESSAGE_LENGTH).toBe(server.MAX_MESSAGE_LENGTH);
    expect(SUPPORTER_DEPARTMENT_COUNT).toBe(server.SUPPORTER_DEPARTMENT_COUNT);
  });

  it('accept every department the server can assign', () => {
    for (let i = 0; i < 400; i++) {
      expect(isSupporterDepartment(server.supporterDepartment(`seed:named:${i}`))).toBe(true);
    }
  });
});
