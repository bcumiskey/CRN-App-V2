-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "businessName" TEXT NOT NULL DEFAULT 'Clean Right Now',
    "ownerName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "financialModel" JSONB NOT NULL,
    "mileageRate" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    "taxYear" INTEGER NOT NULL DEFAULT 2026,
    "contractor1099Threshold" DOUBLE PRECISION NOT NULL DEFAULT 600.0,
    "payPeriodType" TEXT NOT NULL DEFAULT 'monthly',
    "defaultPaymentTerms" TEXT NOT NULL DEFAULT 'Due upon receipt',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1,
    "jobPrefix" TEXT NOT NULL DEFAULT 'JOB',
    "jobNextNumber" INTEGER NOT NULL DEFAULT 1,
    "businessHoursStart" TEXT NOT NULL DEFAULT '08:00',
    "businessHoursEnd" TEXT NOT NULL DEFAULT '18:00',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'worker',
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "statusChangedAt" TEXT,
    "statusReason" TEXT,
    "defaultShare" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "avatarUrl" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "taxIdOnFile" BOOLEAN NOT NULL DEFAULT false,
    "taxIdLastFour" TEXT,
    "mailingAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tabBarSlots" JSONB NOT NULL DEFAULT '[{"position":1,"section":"dashboard"},{"position":2,"section":"jobs"},{"position":3,"section":"calendar"}]',
    "centerAction" TEXT NOT NULL DEFAULT 'quick_add_job',
    "defaultJobsView" TEXT NOT NULL DEFAULT 'list',
    "defaultCalendarView" TEXT NOT NULL DEFAULT 'week',
    "jobCompletionAction" TEXT NOT NULL DEFAULT 'stay',
    "dashboardCards" JSONB,
    "notifyUpcomingJobs" BOOLEAN NOT NULL DEFAULT true,
    "notifyScheduleChanges" BOOLEAN NOT NULL DEFAULT true,
    "notifyOverdueInvoices" BOOLEAN NOT NULL DEFAULT true,
    "upcomingJobLeadDays" INTEGER NOT NULL DEFAULT 7,
    "startOfWeek" TEXT NOT NULL DEFAULT 'sunday',
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "dismissedTips" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyOwner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "address" TEXT,
    "billingType" TEXT NOT NULL DEFAULT 'per_job',
    "paymentTerms" TEXT NOT NULL DEFAULT 'Due upon receipt',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "ownerId" TEXT,
    "defaultJobFee" DOUBLE PRECISION,
    "houseCutPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "accessInstructions" TEXT,
    "parkingNotes" TEXT,
    "wifiName" TEXT,
    "wifiPassword" TEXT,
    "trashDay" TEXT,
    "specialInstructions" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "laundryMethod" TEXT,
    "laundryLocation" TEXT,
    "laundryNotes" TEXT,
    "guestCommsMethod" TEXT,
    "checkInPhotos" BOOLEAN NOT NULL DEFAULT false,
    "checkOutPhotos" BOOLEAN NOT NULL DEFAULT false,
    "preferredTemp" TEXT,
    "petPolicy" TEXT,
    "earliestArrival" TEXT,
    "latestDeparture" TEXT,
    "keyReturnMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "type" TEXT NOT NULL,
    "bedType" TEXT,
    "bedCount" INTEGER NOT NULL DEFAULT 1,
    "hasCrib" BOOLEAN NOT NULL DEFAULT false,
    "hasMurphy" BOOLEAN NOT NULL DEFAULT false,
    "hasTrundle" BOOLEAN NOT NULL DEFAULT false,
    "hasPullout" BOOLEAN NOT NULL DEFAULT false,
    "towelCount" INTEGER,
    "hasRug" BOOLEAN NOT NULL DEFAULT false,
    "hasRobes" BOOLEAN NOT NULL DEFAULT false,
    "hasSlippers" BOOLEAN NOT NULL DEFAULT false,
    "stockingNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyPhoto" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "roomId" TEXT,
    "caption" TEXT,
    "photoType" TEXT NOT NULL DEFAULT 'reference',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingInstruction" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "activeFrom" TEXT,
    "activeUntil" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "scheduledTime" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'STANDARD',
    "jobTypeLabel" TEXT,
    "totalFee" DOUBLE PRECISION NOT NULL,
    "houseCutPercent" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "completedDate" TEXT,
    "clientPaid" BOOLEAN NOT NULL DEFAULT false,
    "clientPaidDate" TEXT,
    "clientPaidMethod" TEXT,
    "teamPaid" BOOLEAN NOT NULL DEFAULT false,
    "teamPaidDate" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "rawSummary" TEXT,
    "syncLocked" BOOLEAN NOT NULL DEFAULT false,
    "isBtoB" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "share" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCharge" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSource" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT,
    "type" TEXT NOT NULL,
    "billingPeriod" TEXT,
    "invoiceDate" TEXT NOT NULL,
    "dueDate" TEXT,
    "paymentTerms" TEXT NOT NULL DEFAULT 'Due upon receipt',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidDate" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "jobId" TEXT,
    "date" TEXT,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "scheduleCLine" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "vendor" TEXT,
    "description" TEXT,
    "receiptUrl" TEXT,
    "loggedById" TEXT,
    "isDeductible" BOOLEAN NOT NULL DEFAULT true,
    "taxYear" INTEGER,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MileageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startLocation" TEXT,
    "endLocation" TEXT,
    "miles" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT,
    "ratePerMile" DOUBLE PRECISION NOT NULL,
    "deductionAmount" DOUBLE PRECISION NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayStatement" (
    "id" TEXT NOT NULL,
    "payPeriodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobsWorked" INTEGER NOT NULL,
    "totalShares" DOUBLE PRECISION NOT NULL,
    "workerPoolPay" DOUBLE PRECISION NOT NULL,
    "ownerPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinenItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendor" TEXT,
    "vendorSku" TEXT,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinenItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyLinenRequirement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "linenItemId" TEXT NOT NULL,
    "quantityPerFlip" INTEGER NOT NULL,

    CONSTRAINT "PropertyLinenRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supply" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "reorderQuantity" INTEGER,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "vendor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyNote" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "photoUrl" TEXT,
    "noteType" TEXT NOT NULL DEFAULT 'general',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "relatedNoteId" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyNotePhoto" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyNotePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "room" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingItemPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "defaultAmount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingItemPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "calendarSourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eventsProcessed" INTEGER NOT NULL DEFAULT 0,
    "eventsCreated" INTEGER NOT NULL DEFAULT 0,
    "eventsUpdated" INTEGER NOT NULL DEFAULT 0,
    "eventsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientUserId" TEXT,
    "subject" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_code_key" ON "Property"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE INDEX "Job_scheduledDate_idx" ON "Job"("scheduledDate");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_propertyId_scheduledDate_idx" ON "Job"("propertyId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "JobAssignment_jobId_userId_key" ON "JobAssignment"("jobId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_ownerId_idx" ON "Invoice"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE INDEX "MileageLog_date_idx" ON "MileageLog"("date");

-- CreateIndex
CREATE INDEX "MileageLog_userId_idx" ON "MileageLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayStatement_payPeriodId_userId_key" ON "PayStatement"("payPeriodId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LinenItem_code_key" ON "LinenItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyLinenRequirement_propertyId_linenItemId_key" ON "PropertyLinenRequirement"("propertyId", "linenItemId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SyncLog_calendarSourceId_idx" ON "SyncLog"("calendarSourceId");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_entityType_entityId_idx" ON "CommunicationLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "PropertyOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingInstruction" ADD CONSTRAINT "StandingInstruction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCharge" ADD CONSTRAINT "JobCharge_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSource" ADD CONSTRAINT "CalendarSource_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "PropertyOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageLog" ADD CONSTRAINT "MileageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayStatement" ADD CONSTRAINT "PayStatement_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "PayPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayStatement" ADD CONSTRAINT "PayStatement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLinenRequirement" ADD CONSTRAINT "PropertyLinenRequirement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLinenRequirement" ADD CONSTRAINT "PropertyLinenRequirement_linenItemId_fkey" FOREIGN KEY ("linenItemId") REFERENCES "LinenItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyNote" ADD CONSTRAINT "PropertyNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyNotePhoto" ADD CONSTRAINT "PropertyNotePhoto_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "PropertyNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
