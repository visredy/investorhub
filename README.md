# InvestorHub

A secure investor dashboard web application for managing investment portfolios, built with Express.js, React, and PostgreSQL.

## Features

- **Authentication**: Secure login/registration with session-based authentication
- **Investor Dashboard**: View total invested, current balance, monthly returns, and ROI
- **ROI Calculator**: Project returns based on investment amount and tenure
- **Payout History**: Track all payouts with status
- **Document Management**: Upload and download investment documents
- **Admin Panel**: Manage investors, investments, payouts, and documents
- **Pool Performance**: View and edit pool metrics with interactive charts
- **Waterfall Engine**: Configure and calculate monthly distributions
- **E-Signature**: Digital signing of investment agreements with PDF generation
- **MifosX Integration**: Sync loan and repayment data from MifosX
- **ABS Pool Management**: Create and manage asset-backed securities pools

## Tech Stack

- **Backend**: Express.js with TypeScript
- **Frontend**: React with TypeScript, TailwindCSS, Shadcn/UI
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with password hashing (scrypt)
- **PDF Generation**: Python with ReportLab

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Python 3.11+ (for PDF generation)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/visredy/investorhub.git
cd investorhub
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```
DATABASE_URL=your_postgres_connection_string
SESSION_SECRET=your_session_secret
```

4. Push database schema:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The app runs on port 5000.

## MifosX Integration (Optional)

To connect with MifosX for loan management:

```
MIFOS_API_URL=https://your-mifos-instance.com/fineract-provider/api/v1
MIFOS_USERNAME=your_username
MIFOS_PASSWORD=your_password
MIFOS_TENANT_ID=default
```

## Project Structure

```
├── client/src/          # React frontend
│   ├── components/      # UI components
│   ├── pages/           # Page components
│   └── lib/             # Utilities and auth
├── server/              # Express backend
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Data access layer
│   └── mifos-*.ts       # MifosX integration
├── shared/              # Shared types and schema
│   └── schema.ts        # Database schema
└── scripts/             # Python PDF generators
```

## License

MIT
