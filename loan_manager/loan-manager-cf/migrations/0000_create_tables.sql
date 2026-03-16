CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`customer_id` integer NOT NULL,
	`phone` text DEFAULT '',
	`appointment_date` text NOT NULL,
	`appointment_time` text NOT NULL,
	`purpose` text DEFAULT '',
	`status` text DEFAULT '待确认',
	`notes` text,
	`created_at` text DEFAULT (datetime('now','localtime')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`customer_no` integer DEFAULT 0,
	`name` text NOT NULL,
	`phone` text DEFAULT '',
	`id_card` text DEFAULT '',
	`address` text DEFAULT '',
	`email` text DEFAULT '',
	`account_manager` text DEFAULT '',
	`emergency_contact` text DEFAULT '',
	`has_overdue` text DEFAULT '否',
	`has_property` text DEFAULT '否',
	`created_at` text DEFAULT (datetime('now','localtime')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `delivery_addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`label` text DEFAULT '',
	`address` text DEFAULT '',
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`expense_date` text NOT NULL,
	`purchase_order_no` text DEFAULT '',
	`supplier_name` text DEFAULT '',
	`supplier_phone` text DEFAULT '',
	`supplier_address` text DEFAULT '',
	`product_name` text DEFAULT '',
	`category` text DEFAULT '',
	`unit` text DEFAULT '',
	`quantity` integer DEFAULT 0,
	`unit_price` text DEFAULT '0.00',
	`total_price` text DEFAULT '0.00',
	`receiver` text DEFAULT '',
	`receiver_phone` text DEFAULT '',
	`receiver_address` text DEFAULT '',
	`notes` text DEFAULT '',
	`payment_account` text DEFAULT '',
	`created_at` text DEFAULT (datetime('now','localtime')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gold_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`price_date` text NOT NULL,
	`buy_price` text NOT NULL,
	`sell_price` text DEFAULT '0.00',
	`updated_by` text DEFAULT '',
	`updated_at` text DEFAULT (datetime('now','localtime'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gold_prices_price_date_unique` ON `gold_prices` (`price_date`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`item_name` text NOT NULL,
	`item_type` text DEFAULT '',
	`quantity` integer DEFAULT 0,
	`unit_value` text DEFAULT '0.00',
	`total_value` text DEFAULT '0.00',
	`location` text DEFAULT '',
	`status` text DEFAULT '在库',
	`last_updated` text DEFAULT (datetime('now','localtime')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`order_date` text NOT NULL,
	`order_no` text NOT NULL,
	`customer_id` integer NOT NULL,
	`phone` text DEFAULT '',
	`id_card` text DEFAULT '',
	`address` text DEFAULT '',
	`email` text DEFAULT '',
	`account_manager` text DEFAULT '',
	`operator` text DEFAULT '',
	`emergency_contact` text DEFAULT '',
	`has_overdue` text DEFAULT '否',
	`has_property` text DEFAULT '否',
	`weight` text DEFAULT '0.00',
	`unit_price` text DEFAULT '0.00',
	`processing_fee` text DEFAULT '0.00',
	`notary_fee` text DEFAULT '0.00',
	`down_payment_ratio` text DEFAULT '0.00',
	`down_payment` text DEFAULT '0.00',
	`payment_account` text DEFAULT '',
	`installment_periods` integer DEFAULT 0,
	`installment_amount` text DEFAULT '0.00',
	`status` text DEFAULT '待审核',
	`credit_reported` integer DEFAULT false,
	`credit_report_fee` text DEFAULT '0.00',
	`credit_reported_at` text,
	`lawsuit_filed` integer DEFAULT false,
	`lawsuit_fee` text DEFAULT '0.00',
	`lawsuit_filed_at` text,
	`manager_commission_paid` integer DEFAULT false,
	`operator_commission_paid` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now','localtime')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE TABLE `payment_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`account` text DEFAULT '',
	`payee` text DEFAULT '',
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`subscription_id` integer,
	`amount` text NOT NULL,
	`payment_method` text DEFAULT '',
	`trade_no` text DEFAULT '',
	`status` text DEFAULT 'pending',
	`created_at` text DEFAULT (datetime('now','localtime')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `repayment_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`order_id` integer NOT NULL,
	`period_no` integer NOT NULL,
	`due_date` text NOT NULL,
	`principal` text NOT NULL,
	`interest` text NOT NULL,
	`total_amount` text NOT NULL,
	`paid_amount` text DEFAULT '0.00',
	`paid_date` text,
	`payment_account` text DEFAULT '',
	`status` text DEFAULT '待还',
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `staff_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`name` text DEFAULT '',
	`phone` text DEFAULT '',
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`plan` text NOT NULL,
	`amount` text NOT NULL,
	`status` text DEFAULT 'active',
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now','localtime')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`name` text DEFAULT '',
	`contact_person` text DEFAULT '',
	`phone` text DEFAULT '',
	`address` text DEFAULT '',
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`key` text NOT NULL,
	`value` text DEFAULT '',
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_phone` text DEFAULT '',
	`status` text DEFAULT 'active',
	`plan` text DEFAULT 'free_trial',
	`trial_end_date` text,
	`subscription_end_date` text,
	`max_users` integer DEFAULT 5,
	`created_at` text DEFAULT (datetime('now','localtime'))
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`real_name` text NOT NULL,
	`email` text DEFAULT '',
	`phone` text DEFAULT '',
	`role` text DEFAULT 'member',
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now','localtime')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `warehouse_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`item_no` text DEFAULT '',
	`barcode` text DEFAULT '',
	`weight` text DEFAULT '0.00',
	`unit_price` text DEFAULT '0.00',
	`total_price` text DEFAULT '0.00',
	`entry_date` text,
	`entry_operator` text DEFAULT '',
	`exit_date` text,
	`exit_operator` text DEFAULT '',
	`buyer` text DEFAULT '',
	`salesperson` text DEFAULT '',
	`notes` text DEFAULT '',
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
