-- CreateTable
CREATE TABLE application_verifications (
    id TEXT NOT NULL,
    applicationId TEXT NOT NULL,
    verifiedByUserId TEXT,
    email TEXT,
    age INTEGER,
    gender TEXT,
    currentLocation TEXT,
    appliedLocation TEXT,
    education TEXT,
    experienceYears INTEGER DEFAULT 0,
    experienceMonths INTEGER DEFAULT 0,
    currentCompany TEXT,
    previousCompany TEXT,
    currentSalary DECIMAL(12,2),
    expectedSalary DECIMAL(12,2),
    noticePeriod TEXT,
    hasTwoWheeler BOOLEAN,
    hasDrivingLicense BOOLEAN,
    interestedInFieldSales BOOLEAN,
    interestedInAutomobile BOOLEAN,
    skills JSONB NOT NULL DEFAULT '[]',
    languages JSONB NOT NULL DEFAULT '[]',
    assets JSONB NOT NULL DEFAULT '[]',
    customAnswers JSONB NOT NULL DEFAULT '{}',
    qualificationStatus TEXT DEFAULT 'PENDING',
    matchSummary JSONB NOT NULL DEFAULT '[]',
    remarks TEXT,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL,

    CONSTRAINT application_verifications_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE UNIQUE INDEX application_verifications_applicationId_key ON application_verifications(applicationId);

-- CreateIndex
CREATE INDEX application_verifications_applicationId_idx ON application_verifications(applicationId);

-- CreateIndex
CREATE INDEX application_verifications_verifiedByUserId_idx ON application_verifications(verifiedByUserId);

-- AddForeignKey
ALTER TABLE application_verifications ADD CONSTRAINT application_verifications_applicationId_fkey FOREIGN KEY (applicationId) REFERENCES applications(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE application_verifications ADD CONSTRAINT application_verifications_verifiedByUserId_fkey FOREIGN KEY (verifiedByUserId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
