# CA·OS Backend Integration Guide

## Overview
The CA·OS frontend has been fully integrated with the CA AI Tool Backend, a Node.js/Express server that provides AI-powered invoice processing, GST compliance, and copilot functionality using Groq API and MongoDB.

## Backend API Endpoints

### Base URL
```
https://ca-ai-tool-backend.onrender.com/
```

### Available Endpoints

#### 1. Client Management
```
POST /api/clients
- Add a new client
- Body: { clientName, businessName, gstNumber, email, phone }

GET /api/clients
- Fetch all clients
```

#### 2. Document Processing
```
POST /api/upload
- Upload and process invoices (PDF/Image with OCR + AI analysis)
- Form Data: { document: File }
- Returns: fileName, filePath, extractedText, aiAnalysis (JSON with invoice details)
```

#### 3. Dashboard Metrics
```
GET /api/dashboard
- Fetch dashboard metrics
- Returns: {
    totalInvoices,
    totalRevenue,
    totalGST,
    paidInvoices,
    pendingInvoices
  }
```

#### 4. AI Copilot
```
POST /api/copilot
- Ask AI questions about financial data
- Body: { question: string }
- Returns: { question, answer, dashboardData }
```

#### 5. GST Compliance Check
```
POST /api/gst-check
- Validate GST compliance
- Body: { taxableAmount, taxAmount, totalAmount }
- Returns: { gstRate, gstComplianceStatus, issuesFound }
```

#### 6. Financial Report
```
GET /api/report
- Generate AI-powered financial report
- Returns: { dashboardData, report }
```

## Frontend Integration Points

### 1. API Client (`lib/api.ts`)
Centralized API client with TypeScript types for all backend endpoints:
- `addClient()` - Create new client
- `getClients()` - Fetch clients list
- `uploadDocument(file)` - Process invoice documents with OCR + AI
- `getDashboardData()` - Fetch metrics
- `askCopilot(question)` - Query AI Copilot
- `checkGSTCompliance()` - Validate GST
- `generateReport()` - Create financial report

### 2. Dashboard Page
- **Metrics Cards**: Display real backend data
  - Total Invoices (from API)
  - Paid Invoices (from API)
  - Pending Invoices (from API)
  - Total GST (from API)

### 3. AI Copilot Page
- **Chat Interface**: Integrated with backend `/api/copilot`
  - Users can ask questions about financial metrics
  - AI responds with analysis based on actual invoice data
  - Loading state while API processes request
  - Quick prompts for common queries

### 4. Document Portal
- **File Upload**: Integrated with backend `/api/upload`
  - Supports PDF, JPG, PNG formats
  - OCR extraction using Tesseract.js on backend
  - AI analysis using Llama 3.1 via Groq API
  - Results displayed in chat and metrics

### 5. Financial Insights
- **Real-time Data**: Dashboard shows live metrics from backend
  - Total Revenue (calculated from invoices)
  - Payment Status (paid vs pending)
  - Tax Summary (GST collected)

## Data Flow

### Invoice Upload Flow
```
1. User uploads document (PDF/Image)
   ↓
2. Frontend sends file to /api/upload
   ↓
3. Backend extracts text using OCR (Tesseract)
   ↓
4. Backend analyzes with AI (Groq Llama 3.1)
   ↓
5. Backend saves to MongoDB (Invoice collection)
   ↓
6. Frontend displays analysis in chat + metrics
```

### Copilot Flow
```
1. User asks question in chat
   ↓
2. Frontend sends to /api/copilot
   ↓
3. Backend retrieves current metrics from database
   ↓
4. Backend sends to Groq API with context
   ↓
5. AI generates response with financial analysis
   ↓
6. Response displayed in chat
```

### Dashboard Data Flow
```
1. Page load → Frontend calls /api/dashboard
   ↓
2. Backend calculates metrics from MongoDB
   ↓
3. Real-time metrics displayed on Dashboard
```

## Key Technologies

### Frontend
- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Custom CSS** - Professional design system

### Backend
- **Node.js + Express** - Server
- **MongoDB + Mongoose** - Database
- **Groq API (Llama 3.1 8B)** - AI models
- **Tesseract.js** - OCR extraction
- **pdf-parse** - PDF text extraction
- **Multer** - File upload handling

## Database Schema

### Client Model
```javascript
{
  clientName: String,
  businessName: String,
  gstNumber: String,
  email: String,
  phone: String
}
```

### Invoice Model
```javascript
{
  invoiceNumber: String,
  customerName: String,
  totalAmount: Number,
  taxAmount: Number,
  paymentStatus: String,
  createdAt: Date
}
```

## Error Handling

- All API calls wrapped in try-catch
- User-friendly error messages displayed
- Loading states while processing
- Graceful fallbacks for network errors

## Security Notes

- CORS enabled on backend
- Form data validation on backend
- Sensitive operations use POST (not GET)
- File uploads validated by type and size

## Performance Features

- Real-time dashboard updates
- Async API calls with loading states
- Chat auto-scrolls to latest message
- Efficient state management with React hooks
- Lazy loading of pages

## Future Enhancements

- Real-time data sync with WebSockets
- User authentication & authorization
- Advanced audit logging
- Multi-user collaboration
- Email notifications for deadlines
- Bulk document processing
- Custom report scheduling

---

**Status**: ✅ Fully Integrated and Tested
**Last Updated**: June 11, 2026
