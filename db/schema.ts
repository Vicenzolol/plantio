import {
  pgTable,
  uuid,
  text,
  date,
  integer,
  numeric,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const swapKindEnum = pgEnum('swap_kind', ['folga', 'extra_turno']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Cada período representa uma escala vigente a partir de uma data.
 * `effectiveFrom` é o início da vigência E a âncora do ciclo (dia 0 = trabalho).
 * `effectiveUntil` nulo = escala ainda vigente (aberta).
 */
export const schedulePeriods = pgTable('schedule_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  effectiveFrom: date('effective_from').notNull(),
  effectiveUntil: date('effective_until'),
  workDays: integer('work_days').notNull().default(1),
  restDays: integer('rest_days').notNull().default(2),
  shiftHours: numeric('shift_hours', { precision: 5, scale: 2 }).notNull().default('12'),
  shiftStartTime: text('shift_start_time'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const extraHours = pgTable('extra_hours', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  hours: numeric('hours', { precision: 5, scale: 2 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const shiftSwaps = pgTable('shift_swaps', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  kind: swapKindEnum('kind').notNull(),
  hours: numeric('hours', { precision: 5, scale: 2 }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type SchedulePeriodRow = typeof schedulePeriods.$inferSelect;
export type ExtraHourRow = typeof extraHours.$inferSelect;
export type ShiftSwapRow = typeof shiftSwaps.$inferSelect;
