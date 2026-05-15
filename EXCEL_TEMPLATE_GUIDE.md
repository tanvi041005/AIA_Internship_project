# Excel Template Guide for Lead Import

## Overview
The "Create Lead Profile" page now supports importing lead data directly from Excel files. Simply drag and drop an Excel file into the dropzone, and the system will automatically detect and populate the form fields.

## Excel Template Format

Your Excel file should contain a header row with column names followed by the data row(s). The system will read the first row of data and map it to the form fields.

### Supported Column Headers

The following Excel column headers are recognized and will auto-map to form fields:

#### Basic Information
- **Full Name** (or: Name)
- **Age**
- **Contact Number** (or: Contact)
- **Email Address** (or: Email)
- **Meet-up Date** (or: Meeting Date, Date)
- **Meeting Type** (or: Type)
- **Location**

#### Lead Classification
- **Urgency** (values: Urgent, Medium, Non-Urgent)
- **Stage** (or: Pipeline Stage) (values: Prospecting, Fact-Find, Needs Analysis, Proposal Sent, Closing)

#### Professional Information
- **Occupation** (or: Job Title)
- **Monthly Income** (or: Income)
- **General Expense** (or: Expense)
- **Surplus**

#### Financial Information
- **CPF OA Balance** (or: CPF OA)
- **CPF SA Balance** (or: CPF SA)
- **Monthly Income**

#### Insurance Plan Information
- **General Plan Type** (or: Plan Category)
- **Specific Plan Type** (or: Plan Type, Product)
- **Currency** (default: SGD)
- **Sum Assured** (or: Coverage Amount)
- **Premium** (or: Premium (Yearly), Annual Premium)
- **Commission Rate**

#### Other Information
- **Referred By** (or: Referrer)
- **Existing Plans** (or: Plans)
- **Remarks** (or: Notes)

## Sample Excel Structure

```
| Full Name          | Age | Contact      | Email            | Meet-up Date | Meeting Type | Location      | Urgency    | Stage            | Occupation        | Monthly Income | CPF OA   | CPF SA   | General Plan Type | Plan Type     | Sum Assured | Premium | Commission Rate | Referred By | Remarks          |
|------------------|-----|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| John Doe       | 35  | 9123-4567    | john@email.com   | 2025-05-20   | Physical     | Marina Bay    | Urgent     | Fact-Find        | Software Engineer | 8000           | 50000   | 20000   | Protection        | Whole Life    | 300000      | 12000   | 15              | Jane Smith  | Interested in term life |
```

## Important Notes

1. **Date Format**: Use YYYY-MM-DD format for date fields (e.g., 2025-05-20)
2. **Currency**: For currency fields, you can use "SGD 5000" or just "5000"
3. **Decimal Numbers**: For commission rate, use decimal format (e.g., 15 for 15%, or 15.5 for 15.5%)
4. **Multiple Plans**: If you have multiple existing plans, separate them with commas or semicolons (e.g., "AIA Endowment; Prudential Term Life; Great Eastern Savings")
5. **Optional Fields**: Not all columns are required. The system will only fill fields that have corresponding values.

## How It Works

1. Navigate to **Create New Lead Profile** page
2. You'll see a dropzone section at the top: **"Import Lead Data from Excel (Optional)"**
3. **Option A - Drag & Drop**: Drag your Excel file directly onto the dropzone area
4. **Option B - Click to Browse**: Click the dropzone to open a file browser and select your Excel file
5. The system will:
   - Parse the Excel file
   - Detect column headers
   - Auto-map values to corresponding form fields
   - Display success message with the number of fields imported
   - Scroll to the form for you to review/edit data
6. You can then:
   - Edit any fields manually if needed
   - Fill in missing optional fields
   - Click "Save Profile" to create the lead

## Supported File Formats

- `.xlsx` (Excel 2007 and later)
- `.xls` (Excel 97-2003)

## Tips for Best Results

- Ensure column headers match the supported headers listed above (case-sensitive)
- Start data from row 2 (row 1 should contain headers)
- Use consistent formatting for dates (YYYY-MM-DD)
- Remove empty rows and columns
- Avoid special characters in column headers

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid file type" | Make sure you're uploading an Excel file (.xlsx or .xls) |
| "No data found" | Ensure your Excel file contains at least one data row |
| "No matching fields found" | Check that your column headers match the supported headers list |
| Fields not populating | Verify the column header spelling and format |
| Commission not calculating | Ensure both Premium and Commission Rate fields have numeric values |

## Excel Template Example File

You can create a template file with headers pre-filled for your team to use. Save it as `.xlsx` and share with agents.
