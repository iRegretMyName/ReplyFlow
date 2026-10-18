import { randomUUID } from 'node:crypto';

export const newId = (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`;
