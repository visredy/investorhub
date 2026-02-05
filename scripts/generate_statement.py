#!/usr/bin/env python3
import sys
import json
import os
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

def generate_statement(data, output_path):
    doc = SimpleDocTemplate(output_path, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=24, spaceAfter=20, alignment=TA_CENTER)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, spaceBefore=20, spaceAfter=10)
    normal_style = styles['Normal']
    right_style = ParagraphStyle('Right', parent=styles['Normal'], alignment=TA_RIGHT)
    
    elements = []
    
    elements.append(Paragraph("InvestorHub", title_style))
    elements.append(Paragraph("Monthly Investment Statement", styles['Heading2']))
    elements.append(Spacer(1, 0.3*inch))
    
    investor_name = data.get('investorName', 'Investor')
    investor_email = data.get('investorEmail', '')
    statement_month = data.get('month', datetime.now().strftime('%B %Y'))
    generated_date = datetime.now().strftime('%B %d, %Y')
    
    header_data = [
        ['Investor:', investor_name, 'Statement Period:', statement_month],
        ['Email:', investor_email, 'Generated:', generated_date],
    ]
    header_table = Table(header_data, colWidths=[1.2*inch, 2.5*inch, 1.3*inch, 2*inch])
    header_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.4*inch))
    
    elements.append(Paragraph("Account Summary", heading_style))
    
    opening_balance = float(data.get('openingBalance', 0))
    returns = float(data.get('returns', 0))
    payouts = float(data.get('payouts', 0))
    closing_balance = float(data.get('closingBalance', 0))
    roi = float(data.get('roi', 0))
    
    def format_currency(amount):
        return f"${amount:,.2f}"
    
    summary_data = [
        ['Description', 'Amount'],
        ['Opening Balance', format_currency(opening_balance)],
        ['Investment Returns', format_currency(returns)],
        ['Payouts Received', f"({format_currency(payouts)})"],
        ['Closing Balance', format_currency(closing_balance)],
    ]
    
    summary_table = Table(summary_data, colWidths=[4*inch, 2.5*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f4f8')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.3*inch))
    
    elements.append(Paragraph("Investment Details", heading_style))
    
    investments = data.get('investments', [])
    if investments:
        inv_data = [['Description', 'Start Date', 'Amount', 'ROI']]
        for inv in investments:
            inv_data.append([
                inv.get('description', 'Investment'),
                inv.get('startDate', '-'),
                format_currency(float(inv.get('amount', 0))),
                f"{float(inv.get('roi', 0)):.1f}%"
            ])
        
        inv_table = Table(inv_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch, 1*inch])
        inv_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]))
        elements.append(inv_table)
    else:
        elements.append(Paragraph("No active investments for this period.", normal_style))
    
    elements.append(Spacer(1, 0.3*inch))
    
    elements.append(Paragraph("Payout History", heading_style))
    
    payout_list = data.get('payoutList', [])
    if payout_list:
        payout_data = [['Month', 'Amount', 'Status']]
        for p in payout_list:
            payout_data.append([
                p.get('month', '-'),
                format_currency(float(p.get('amount', 0))),
                p.get('status', '-').capitalize()
            ])
        
        payout_table = Table(payout_data, colWidths=[2.5*inch, 2*inch, 2*inch])
        payout_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]))
        elements.append(payout_table)
    else:
        elements.append(Paragraph("No payouts recorded for this period.", normal_style))
    
    elements.append(Spacer(1, 0.5*inch))
    
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.gray, alignment=TA_CENTER)
    elements.append(Paragraph("This statement is for informational purposes only.", footer_style))
    elements.append(Paragraph(f"Generated by InvestorHub on {generated_date}", footer_style))
    
    doc.build(elements)
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python generate_statement.py <input_json_path> <output_path>", file=sys.stderr)
        sys.exit(1)
    
    try:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
        
        with open(input_path, 'r') as f:
            data = json.load(f)
        
        result = generate_statement(data, output_path)
        print(json.dumps({"success": True, "path": result}))
    except FileNotFoundError as e:
        print(json.dumps({"success": False, "error": f"Input file not found: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
