import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================
// 1. USERS TABLE
// ============================================
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name'),
    passwordChanged: boolean('password_changed').default(false).notNull(),
    termsAccepted: boolean('terms_accepted').default(false),
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
}));

// ============================================
// 2. USER PROFILES TABLE
// ============================================
export const userProfiles = pgTable('user_profiles', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
    currentLevel: text('current_level').default('A1').notNull(),
    currentDay: integer('current_day').default(1).notNull(),
    listeningScore: integer('listening_score').default(0).notNull(),
    readingScore: integer('reading_score').default(0).notNull(),
    speakingScore: integer('speaking_score').default(0).notNull(),
    grammarScore: integer('grammar_score').default(0).notNull(),
    streakDays: integer('streak_days').default(0).notNull(),
    totalStudyMinutes: integer('total_study_minutes').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('idx_user_profiles_user_id').on(table.userId),
}));

// ============================================
// 3. LESSON PROGRESS TABLE
// ============================================
export const lessonProgress = pgTable('lesson_progress', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    dayNumber: integer('day_number').notNull(),
    lessonId: text('lesson_id').notNull(),
    completed: boolean('completed').default(false).notNull(),
    videoWatched: boolean('video_watched').default(false).notNull(),
    exercisesCompleted: boolean('exercises_completed').default(false).notNull(),
    score: integer('score').default(0).notNull(),
    timeSpentMinutes: integer('time_spent_minutes').default(0).notNull(),
    savedAnswers: jsonb('saved_answers'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userDayIdx: index('idx_lesson_progress_user_day').on(table.userId, table.dayNumber),
    completedIdx: index('idx_lesson_progress_completed').on(table.userId, table.completed),
}));

// ============================================
// 4. VOCABULARY PROGRESS TABLE
// ============================================
export const vocabularyProgress = pgTable('vocabulary_progress', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    word: text('word').notNull(),
    translation: text('translation').notNull(),
    level: text('level').notNull(),
    masteryLevel: integer('mastery_level').default(0).notNull(),
    nextReviewDate: timestamp('next_review_date', { withTimezone: true }).defaultNow().notNull(),
    reviewCount: integer('review_count').default(0).notNull(),
    correctCount: integer('correct_count').default(0).notNull(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    nextReviewIdx: index('idx_vocabulary_next_review').on(table.userId, table.nextReviewDate),
    levelIdx: index('idx_vocabulary_level').on(table.userId, table.level),
}));

// ============================================
// 5. AI CONVERSATIONS TABLE (DISABLED - للاستخدام المستقبلي)
// ============================================
// export const aiConversations = pgTable('ai_conversations', {
//     id: uuid('id').primaryKey().defaultRandom(),
//     userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
//     scenario: text('scenario').notNull(),
//     message: text('message').notNull(),
//     role: text('role').notNull(),
//     corrections: jsonb('corrections').default(sql`'[]'::jsonb`).notNull(),
//     createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
// }, (table) => ({
//     userCreatedIdx: index('idx_ai_conversations_user').on(table.userId, table.createdAt),
//     scenarioIdx: index('idx_ai_conversations_scenario').on(table.userId, table.scenario),
// }));


// ============================================
// 6. DAILY TASKS TABLE
// ============================================
export const dailyTasks = pgTable('daily_tasks', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    dayNumber: integer('day_number').notNull(),
    taskType: text('task_type').notNull(),
    taskDescription: text('task_description').notNull(),
    completed: boolean('completed').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
    userDayIdx: index('idx_daily_tasks_user_day').on(table.userId, table.dayNumber),
    completedIdx: index('idx_daily_tasks_completed').on(table.userId, table.completed),
}));

// ============================================
// 7. ACHIEVEMENTS TABLE
// ============================================
export const achievements = pgTable('achievements', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    achievementType: text('achievement_type').notNull(),
    achievementName: text('achievement_name').notNull(),
    description: text('description'),
    earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    userEarnedIdx: index('idx_achievements_user').on(table.userId, table.earnedAt),
}));
