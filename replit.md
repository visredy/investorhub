# InvestorHub - Investor Dashboard

## Overview
A secure web application for managing investor portfolios. Features login/registration, investor dashboard with financial stats, admin panel for managing investors, document upload/download functionality, waterfall distribution engine, ROI calculator, and e-signature for investment agreements.

## Tech Stack
- **Backend**: Express.js with TypeScript
- **Frontend**: React with TypeScript, TailwindCSS, Shadcn/UI
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with password hashing (scrypt)
- **PDF Generation**: Python with ReportLab

## Project Structure
```
├── client/src/
│   ├── App.tsx              # Main app with routing
│   ├── lib/auth.tsx         # Auth context and hooks
│   ├── components/
│   │   └── signature-pad.tsx # Canvas-based signature component
│   └── pages/
│       ├── login.tsx        # Login page
│       ├── register.tsx     # Registration page
│       ├── dashboard.tsx    # Investor dashboard with ROI calculator
│       ├── agreements.tsx   # Investor agreements (e-signature)
│       └── admin/
│           ├── dashboard.tsx     # Admin dashboard
│           ├── add-investor.tsx  # Add new investor
│           ├── investor-detail.tsx # Investor detail view
│           ├── waterfall.tsx     # Waterfall config & distributions
│           └── agreements.tsx    # Admin agreement management
├── server/
│   ├── db.ts                # Database connection
│   ├── storage.ts           # Data access layer
│   └── routes.ts            # API routes
├── shared/
│   └── schema.ts            # Database schema & types
├── scripts/
│   ├── generate_statement.py        # Monthly PDF statement generator
│   └── generate_signed_agreement.py # Signed agreement PDF generator
├── uploads/                 # Document storage
└── signed_agreements/       # Signed PDF storage
```

## Database Schema
- **users**: id, name, email, password, role (admin/investor)
- **investments**: id, user_id, amount, start_date, roi, description
- **payouts**: id, user_id, month, amount, status
- **documents**: id, user_id, filename, original_filename, description, upload_date
- **pool_performance**: id, total_pool_size, active_loans, par_1_plus, par_7_plus, par_30_plus, monthly_collections, reserve_balance, default_rate, updated_at
- **pool_performance_history**: id, month, (same metrics), created_at
- **waterfall_config**: id, servicing_fee_percent, investor_returns_percent, reserve_fund_percent, sponsor_profit_percent
- **waterfall_distributions**: id, month, total_collections, servicing_fee, investor_returns, reserve_fund, sponsor_profit, (percentages), created_at
- **agreements**: id, user_id, title, content, investment_amount, status (pending/signed/expired), signature_data, signed_pdf_filename, signed_at, expires_at
- **abs_pools**: id, name, target_amount, status (draft/open/locked/closed), created_at, locked_at
- **pool_loans**: id, pool_id, mifos_loan_id, added_at

## API Routes
- **Auth**: POST /api/auth/login, /api/auth/register, /api/auth/logout, GET /api/auth/me
- **Dashboard**: GET /api/dashboard/stats, /investments, /payouts, /documents, /statement-months, /statement/:month
- **Agreements**: GET /api/agreements, /api/agreements/:id, POST /api/agreements/:id/sign, GET /api/agreements/:id/download
- **Admin**: GET /api/admin/stats, /investors, /investor/:id, /agreements; POST /api/admin/agreements
- **Admin Actions**: POST investor, investment, payout, document; PATCH roi, status; DELETE document
- **Pool Performance**: GET/PUT /api/pool-performance, POST /api/pool-performance/history
- **Waterfall**: GET /api/waterfall/config, /api/waterfall/distributions; PUT /api/waterfall/config; POST /api/waterfall/distribute
- **MifosX**: GET /api/mifos/status, /api/mifos/loans, /api/mifos/loans/:loanId/repayments, /api/mifos/portfolio-summary, /api/mifos/par-report, /api/mifos/sync-logs, /api/mifos/synced-loans, /api/mifos/synced-loans/:loanId/repayments; POST /api/mifos/clear-cache, /api/mifos/sync
- **ABS Pools**: GET /api/pools, /api/pools/:id, /api/pools/:id/loans, /api/pools/:id/available-loans; POST /api/pools, /api/pools/:id/loans; PATCH /api/pools/:id/status; DELETE /api/pools/:id, /api/pools/:id/loans/:mifosLoanId

## Key Features
1. **Authentication**: Login/registration with password hashing
2. **Investor Dashboard**: View total invested, current balance, monthly return, ROI %
3. **ROI Calculator**: Project returns based on investment amount and tenure
4. **Payout History**: Table of all payouts with status
5. **Document Access**: Download uploaded reports
6. **Admin Panel**: Add investors, manage investments, record payouts, upload documents
7. **Pool Performance**: View/edit pool metrics (PAR rates, collections, reserves, defaults) with charts
8. **PDF Statements**: Generate downloadable monthly investment statements
9. **Waterfall Engine**: Configure and calculate monthly distributions (servicing fee, investor returns, reserve, sponsor profit)
10. **E-Signature**: Digital signing of investment agreements with signature pad and signed PDF generation
11. **MifosX Integration**: Connect to MifosX API for loans, repayments, portfolio summary, and PAR reports with 10-minute caching
12. **ABS Pool Management**: Create pools, assign loans from MifosX, lock pools, and calculate pool metrics

## MifosX Integration
The app integrates with MifosX REST API for loan management data. Configure these environment variables:
- `MIFOS_API_URL`: Base URL of your MifosX API (e.g., https://your-mifos-instance.com/fineract-provider/api/v1)
- `MIFOS_USERNAME`: MifosX username for Basic Auth
- `MIFOS_PASSWORD`: MifosX password for Basic Auth
- `MIFOS_TENANT_ID`: (Optional) Tenant ID, defaults to "default"

The service module (`server/mifos-service.ts`) provides:
- `getLoans()`: Fetch all loans
- `getRepayments(loanId)`: Get repayments for a specific loan
- `getPortfolioSummary()`: Get portfolio statistics
- `getParReport()`: Get Portfolio at Risk report
- Results are cached for 10 minutes

### Background Scheduler
The app includes a background scheduler (`server/mifos-scheduler.ts`) using node-cron that:
- Runs every 6 hours automatically
- Fetches all loans and repayments from MifosX
- Stores data in local database tables (mifos_loans, mifos_repayments)
- Logs sync status to mifos_sync_logs table
- Can be triggered manually via POST /api/mifos/sync

## Demo Accounts
- **Admin**: admin@example.com / admin123
- **Investor**: john@example.com / password123

## Running the App
```bash
npm run dev
```
The app runs on port 5000.

## Recent Changes
- Added MifosX background scheduler (node-cron) for 6-hour sync with local database storage
- Added MifosX REST API integration with Basic Auth, 10-minute caching, and error handling
- Added PDF statement generation using ReportLab (Python)
- Added pool performance page with 8 metrics and 4 interactive charts
- Rebuilt application using Express + React stack
- Created authentication system with session management
- Built responsive UI with Shadcn components
- Implemented admin panel with full CRUD operations
- Added document upload/download functionality
- Database seeded with sample investors and data
