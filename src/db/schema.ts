import { relations } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('user'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.uid, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  projectCode: text('project_code'),
  location: text('location'),
  resolvedAddress: text('resolved_address'),
  latitude: text('latitude'),
  longitude: text('longitude'),
  imageUrl: text('image_url'),
  totalArea: text('total_area'),
  floorsUnderground: integer('floors_underground'),
  floorsAboveground: integer('floors_aboveground'),
  totalBudget: text('total_budget'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status').default('준비'),
  color: text('color'),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const schedules = pgTable('schedules', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  category: text('category'),
  subCategory: text('sub_category'),
  taskName: text('task_name').notNull(),
  siteName: text('site_name'),
  dongBlock: text('dong_block'),
  zone: text('zone'),
  floor: text('floor'),
  detailLocation: text('detail_location'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  periods: jsonb('periods'),
  duration: integer('duration'),
  progress: integer('progress').default(0),
  status: text('status').default('예정'),
  predecessor: text('predecessor'),
  contractor: text('contractor'),
  memo: text('memo'),
  isBaseline: integer('is_baseline').default(0),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dailyReports = pgTable('daily_reports', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  weather: jsonb('weather'),
  tasks: jsonb('tasks'),
  equipment: jsonb('equipment'),
  personnel: jsonb('personnel'),
  issues: jsonb('issues'),
  photos: jsonb('photos'),
  notes: text('notes'),
  status: text('status'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.uid],
  }),
  schedules: many(schedules),
  dailyReports: many(dailyReports),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  project: one(projects, {
    fields: [schedules.projectId],
    references: [projects.id],
  }),
}));

export const dailyReportsRelations = relations(dailyReports, ({ one }) => ({
  project: one(projects, {
    fields: [dailyReports.projectId],
    references: [projects.id],
  }),
}));
