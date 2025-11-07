# MindMesh - Your Second Brain

A powerful multi-tenant knowledge management system built with Next.js, Supabase, and TypeScript. Capture notes, manage tasks, store files, and collaborate with teams—all with industry-level security and scalability.

## Features

- 📝 **Notes**: Rich text notes with tags and full-text search
- ✅ **Tasks**: Track progress with due dates and status updates  
- 📎 **Files & Links**: Store documents, images, and web links
- 🔔 **Reminders**: Never miss important deadlines
- 💬 **AI Chat**: Ask questions about your knowledge base
- 👥 **Multi-Tenant Organizations**: Secure team collaboration with role-based access
- 🔒 **Privacy-First**: Row-level security (RLS) ensures data isolation

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm, pnpm, or yarn
- Supabase account (free tier works)

### Installation

```bash
# Clone the repository
git clone https://github.com/MohitS2004/MindMesh.git
cd second-brain

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase project URL and keys

# Run database migrations
# 1. Go to your Supabase project dashboard
# 2. Open SQL Editor
# 3. Run db/schema.sql
# 4. Run db/policies.sql

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

See `db/schema.sql` and `db/policies.sql` for the multi-tenant schema with RLS policies.

Key features:
- Auto-admin assignment for tenant creators
- Last-admin protection (cannot remove/demote the only admin)
- Row-level security for data isolation

