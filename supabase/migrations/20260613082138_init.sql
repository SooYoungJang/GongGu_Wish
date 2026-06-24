-- CreateEnum
CREATE TYPE "ParsingStatus" AS ENUM ('NEW', 'PENDING', 'EXPORTED', 'PARSED', 'NOT_GROUP_BUY', 'FAILED');

-- CreateEnum
CREATE TYPE "GroupBuyStatus" AS ENUM ('APPROVED', 'REVIEW_REQUIRED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "influencers" (
    "id" TEXT NOT NULL,
    "instagram_username" TEXT NOT NULL,
    "display_name" TEXT,
    "profile_image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_posts" (
    "id" TEXT NOT NULL,
    "instagram_post_id" TEXT NOT NULL,
    "influencer_id" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "post_url" TEXT NOT NULL,
    "image_url" TEXT,
    "taken_at" TIMESTAMP(3) NOT NULL,
    "content_hash" TEXT NOT NULL,
    "is_candidate" BOOLEAN NOT NULL DEFAULT false,
    "parsing_status" "ParsingStatus" NOT NULL DEFAULT 'NEW',
    "exported_at" TIMESTAMP(3),
    "parsed_at" TIMESTAMP(3),
    "parse_error" TEXT,
    "collected_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_buys" (
    "id" TEXT NOT NULL,
    "raw_post_id" TEXT,
    "product_name" TEXT,
    "brand_name" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "purchase_url" TEXT,
    "discount_info" TEXT,
    "summary" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "GroupBuyStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_buys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nickname" TEXT,
    "fcm_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_buy_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "influencers_instagram_username_key" ON "influencers"("instagram_username");

-- CreateIndex
CREATE UNIQUE INDEX "raw_posts_instagram_post_id_key" ON "raw_posts"("instagram_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_posts_content_hash_key" ON "raw_posts"("content_hash");

-- CreateIndex
CREATE INDEX "raw_posts_influencer_id_idx" ON "raw_posts"("influencer_id");

-- CreateIndex
CREATE INDEX "raw_posts_is_candidate_parsing_status_idx" ON "raw_posts"("is_candidate", "parsing_status");

-- CreateIndex
CREATE UNIQUE INDEX "group_buys_raw_post_id_key" ON "group_buys"("raw_post_id");

-- CreateIndex
CREATE INDEX "group_buys_status_idx" ON "group_buys"("status");

-- CreateIndex
CREATE INDEX "group_buys_end_date_idx" ON "group_buys"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_group_buy_id_key" ON "favorites"("user_id", "group_buy_id");

-- AddForeignKey
ALTER TABLE "raw_posts" ADD CONSTRAINT "raw_posts_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_buys" ADD CONSTRAINT "group_buys_raw_post_id_fkey" FOREIGN KEY ("raw_post_id") REFERENCES "raw_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_group_buy_id_fkey" FOREIGN KEY ("group_buy_id") REFERENCES "group_buys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
