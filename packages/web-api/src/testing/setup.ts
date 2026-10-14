/*
 * Предзагрузка тестов пакета (bunfig.toml). Окружение (src/env.ts) читается
 * один раз на процесс, а bun гоняет все файлы тестов в одном процессе:
 * секреты задаём здесь, до первого импорта, а не в каждом тесте.
 */
export const JOBS_SECRET = "synthetic-jobs-secret-0123456789abcdef";
export const ADMIN_SECRET = "synthetic-admin-secret-0123456789abcdef";

process.env.JOBS_SECRET = JOBS_SECRET;
process.env.REVALIDATE_SECRET = ADMIN_SECRET;
