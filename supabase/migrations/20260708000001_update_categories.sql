-- ============================================================================
-- Update category taxonomy: 6 -> 15 categories
-- New set: food, living, beauty, fashion, home, kitchen, electronics,
--          pet, auto, hobby, baby, sports, stationery, books, media
-- ============================================================================

-- Step 1: Migrate old category values to new ones
UPDATE public.group_buys SET category = 'living' WHERE category = 'lifestyle';
UPDATE public.group_buys SET category = 'electronics' WHERE category = 'digital';
UPDATE public.gonggu_submissions SET category = 'living' WHERE category = 'lifestyle';
UPDATE public.gonggu_submissions SET category = 'electronics' WHERE category = 'digital';

-- Step 2: Drop old constraints
ALTER TABLE public.gonggu_submissions DROP CONSTRAINT IF EXISTS gonggu_submissions_category_check;
ALTER TABLE public.group_buys DROP CONSTRAINT IF EXISTS group_buys_category_check;

-- Step 3: Add new constraints with updated category list
ALTER TABLE public.gonggu_submissions
  ADD CONSTRAINT gonggu_submissions_category_check
  CHECK (
    category IS NULL
    OR category IN (
      'food', 'living', 'beauty', 'fashion', 'home', 'kitchen',
      'electronics', 'pet', 'auto', 'hobby', 'baby', 'sports',
      'stationery', 'books', 'media', 'travel'
    )
  );

ALTER TABLE public.group_buys
  ADD CONSTRAINT group_buys_category_check
  CHECK (
    category IS NULL
    OR category IN (
      'food', 'living', 'beauty', 'fashion', 'home', 'kitchen',
      'electronics', 'pet', 'auto', 'hobby', 'baby', 'sports',
      'stationery', 'books', 'media', 'travel'
    )
  );
-- Indices already exist from previous migration; no change needed.
