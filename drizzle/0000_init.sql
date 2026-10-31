CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`status` text NOT NULL,
	`prompt` text NOT NULL,
	`style_id` text NOT NULL,
	`aspect_ratio` text NOT NULL,
	`source_key` text NOT NULL,
	`model_preset_id` text NOT NULL,
	`model_name` text NOT NULL,
	`ip_hash` text NOT NULL,
	`cost_usd` real,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `generations_ip_idx` ON `generations` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`status` text NOT NULL,
	`variant_id` text NOT NULL,
	`product_id` text NOT NULL,
	`orientation` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`item_price` integer NOT NULL,
	`shipping_price` integer NOT NULL,
	`amount_total` integer,
	`currency` text NOT NULL,
	`stripe_session_id` text,
	`customer_email` text,
	`customer_name` text,
	`customer_phone` text,
	`shipping_address` text,
	`print_file_key` text,
	`fulfillment_provider` text,
	`fulfillment_order_id` text,
	`tracking_url` text,
	`error` text,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`position` integer NOT NULL,
	`status` text NOT NULL,
	`image_key` text,
	`preview_key` text,
	`width` integer,
	`height` integer,
	`error` text,
	FOREIGN KEY (`generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variants_generation_idx` ON `variants` (`generation_id`);