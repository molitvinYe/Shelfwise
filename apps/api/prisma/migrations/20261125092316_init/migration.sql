-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ShelfStatus" AS ENUM ('WANT', 'READING', 'READ');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" UUID NOT NULL,
    "olKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "description" TEXT,
    "year" INTEGER,
    "subjects" TEXT[],
    "language" TEXT,
    "coverId" INTEGER,
    "searchVector" tsvector,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBook" (
    "userId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "status" "ShelfStatus" NOT NULL,
    "rating" INTEGER,
    "review" TEXT,
    "isReviewHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserBook_pkey" PRIMARY KEY ("userId","bookId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionBook" (
    "collectionId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CollectionBook_pkey" PRIMARY KEY ("collectionId","bookId")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("userId","date")
);

-- CreateTable
CREATE TABLE "AiIpUsage" (
    "ipHash" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiIpUsage_pkey" PRIMARY KEY ("ipHash","date")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_olKey_key" ON "Book"("olKey");

-- CreateIndex
CREATE INDEX "Book_searchVector_idx" ON "Book" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "Book_subjects_idx" ON "Book" USING GIN ("subjects");

-- CreateIndex
CREATE INDEX "Book_year_idx" ON "Book"("year");

-- CreateIndex
CREATE INDEX "Book_language_idx" ON "Book"("language");

-- CreateIndex
CREATE INDEX "Book_title_id_idx" ON "Book"("title", "id");

-- CreateIndex
CREATE INDEX "Book_createdAt_id_idx" ON "Book"("createdAt", "id");

-- CreateIndex
CREATE INDEX "UserBook_userId_status_updatedAt_idx" ON "UserBook"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "UserBook_bookId_updatedAt_idx" ON "UserBook"("bookId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_ownerId_updatedAt_idx" ON "Collection"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "CollectionBook_collectionId_position_idx" ON "CollectionBook"("collectionId", "position");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionBook" ADD CONSTRAINT "CollectionBook_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionBook" ADD CONSTRAINT "CollectionBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: things Prisma schema can't express.
-- ---------------------------------------------------------------------------

-- Ratings are 1–5 (NULL = not rated).
ALTER TABLE "UserBook"
  ADD CONSTRAINT "UserBook_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

-- Collection positions are 0-based.
ALTER TABLE "CollectionBook"
  ADD CONSTRAINT "CollectionBook_position_check" CHECK ("position" >= 0);

-- AI counters never go negative.
ALTER TABLE "AiUsage"
  ADD CONSTRAINT "AiUsage_counters_check" CHECK ("requests" >= 0 AND "tokens" >= 0);
ALTER TABLE "AiIpUsage"
  ADD CONSTRAINT "AiIpUsage_requests_check" CHECK ("requests" >= 0);

-- Full-text search vector for books (docs/adr/0004).
-- A trigger, not a generated column: array_to_string() is not IMMUTABLE, so it can't be used in one.
-- Weights: title A, authors B, description C, subjects D.
-- Everything uses the 'english' config, and queries must use it too (websearch_to_tsquery('english', ...)):
-- mixing configs breaks matching, e.g. subject 'romance' indexed as 'romance' vs query stemmed to 'romanc'.
CREATE FUNCTION book_search_vector_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."authors", ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."subjects", ' '), '')), 'D');
  RETURN NEW;
END
$$;

CREATE TRIGGER book_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "authors", "description", "subjects"
  ON "Book"
  FOR EACH ROW
  EXECUTE FUNCTION book_search_vector_update();
