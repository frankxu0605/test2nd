-- Username scoped to tenant (not globally unique)
DROP INDEX IF EXISTS `users_username_unique`;
CREATE UNIQUE INDEX `users_tenant_username_unique` ON `users` (`tenant_id`, `username`);

-- Token version for single-device login enforcement
ALTER TABLE `users` ADD COLUMN `token_version` INTEGER DEFAULT 0;
