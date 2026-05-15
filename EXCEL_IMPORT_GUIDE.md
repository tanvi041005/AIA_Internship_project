# Excel Import Feature - Quick Reference

## Feature Overview

The **Create Lead Profile** page now includes an Excel import feature that allows users to:
- 📥 Upload lead data from Excel files (.xlsx, .xls)
- 🎯 Auto-detect and map column data to form fields
- ⚡ Quickly populate forms without manual entry
- ✏️ Manually edit and refine data as needed

## How to Use

### Step 1: Prepare Your Excel File
Create an Excel file with your lead data. The first row should contain headers (column names), and subsequent rows contain the lead data.

**Example:**
```
Full Name | Age | Contact | Email | Meet-up Date | Location | Urgency | Stage
John Doe | 35 | 9123-4567 | john@example.com | 2025-05-20 | Marina Bay | Urgent | Fact-Find
```

### Step 2: Navigate to Create Lead Profile
Go to the **"Create New Lead Profile"** page in the Financial Agent Dashboard.

### Step 3: Upload Your Excel File
You'll see the **"Import Lead Data from Excel (Optional)"** section at the top:

**Option A - Drag & Drop:**
- Drag your Excel file directly onto the dropzone area
- Drop it when you see the highlighted border

**Option B - Click to Browse:**
- Click the dropzone area
- Select your Excel file from the file browser

### Step 4: Review Results
- The system displays a success message showing how many fields were imported
- The form automatically scrolls to the top to show you the populated data
- Check and verify all the imported information

### Step 5: Complete and Save
- Edit any fields that need adjustment
- Fill in any missing optional fields
- Click **"Save Profile"** to create/update the lead

## Supported Excel Column Headers

| Category | Supported Headers |
|----------|------------------|
| **Name** | Full Name, Name |
| **Age** | Age |
| **Contact** | Contact Number, Contact |
| **Email** | Email Address, Email |
| **Date** | Meet-up Date, Meeting Date, Date |
| **Meeting Type** | Meeting Type, Type |
| **Location** | Location |
| **Urgency** | Urgency |
| **Pipeline Stage** | Stage, Pipeline Stage |
| **Job** | Occupation, Job Title |
| **Income** | Monthly Income, Income |
| **Expenses** | General Expense, Expense |
| **Savings** | Surplus |
| **CPF OA** | CPF OA Balance, CPF OA |
| **CPF SA** | CPF SA Balance, CPF SA |
| **Plan Category** | General Plan Type, Plan Category |
| **Plan Type** | Specific Plan Type, Plan Type, Product |
| **Currency** | Currency |
| **Coverage** | Sum Assured, Coverage Amount |
| **Premium** | Premium, Premium (Yearly), Annual Premium |
| **Commission** | Commission Rate |
| **Referral** | Referred By, Referrer |
| **Plans** | Existing Plans, Plans |
| **Notes** | Remarks, Notes |

## Format Guidelines

| Field Type | Format | Example |
|-----------|--------|---------|
| **Dates** | YYYY-MM-DD | 2025-05-20 |
| **Phone** | Any format | 9123-4567 or (91)2345-67 |
| **Currency** | Number or with prefix | 5000 or SGD 5000 |
| **Decimal** | Use . not , | 15.5 for 15.5% |
| **Multiple Plans** | Separate with commas or semicolons | Plan A; Plan B, Plan C |

## Important Notes

✅ **Do's:**
- Use consistent column header names
- Format dates as YYYY-MM-DD
- Keep file size reasonable
- Test with a small file first
- Have headers in row 1, data from row 2 onwards

❌ **Don'ts:**
- Don't use special characters in headers
- Don't mix date formats in one column
- Don't leave important fields empty in template
- Don't use formula results - use actual values
- Don't have empty rows between data rows

## Troubleshooting

| Problem | Solution |
|---------|----------|
| File upload not working | Ensure file is .xlsx or .xls format |
| "No data found" error | Check that spreadsheet has data in row 2+ |
| Fields not auto-filling | Verify column headers match supported headers |
| Some fields missing | Check column header spelling (case-sensitive for exact match) |
| Commission not calculating | Ensure both Premium and Commission Rate have numeric values |
| Need to clear imported data | Simply refresh the page and start over |

## Pro Tips

1. **Create a Template** - Save a blank template file with standard headers for your team
2. **Batch Import** - Import multiple leads one at a time (copy new row data before each import)
3. **Verify Data** - Always review imported data before saving
4. **Manual Adjustment** - You can manually edit any field after import
5. **Existing Plans** - Separate multiple plans with commas or semicolons for easy parsing

## Sample Excel Template

Download or create an Excel file with this structure:

```
Full Name | Age | Contact | Email | Meet-up Date | Meeting Type | Location | Urgency | Stage | Occupation | Monthly Income | CPF OA | CPF SA | General Plan Type | Plan Type | Sum Assured | Premium | Commission Rate | Referred By | Remarks
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
[Your Lead Data] | [Age] | [Phone] | [Email] | [2025-MM-DD] | [Physical/Online/Hybrid] | [Location] | [Urgent/Medium/Non-Urgent] | [Prospecting/Fact-Find/etc] | [Job] | [Amount] | [Amount] | [Amount] | [Plan Category] | [Product] | [Amount] | [Amount] | [Percentage] | [Name] | [Notes]
```

## Contact Support

If you encounter issues or have questions about the Excel import feature, please contact your system administrator or refer to the EXCEL_TEMPLATE_GUIDE.md for detailed information.
