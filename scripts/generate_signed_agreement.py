#!/usr/bin/env python3
import sys
import json
import base64
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image

def generate_signed_agreement(data, output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        spaceAfter=20,
        alignment=1,
        textColor=colors.HexColor('#1a1a2e')
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=15,
        spaceAfter=10,
        textColor=colors.HexColor('#1a1a2e')
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=8,
        leading=16
    )
    
    legal_style = ParagraphStyle(
        'LegalText',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        leading=14,
        textColor=colors.HexColor('#444444')
    )
    
    elements = []
    
    elements.append(Paragraph("INVESTMENT AGREEMENT", title_style))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph(data.get('title', 'Investment Agreement'), heading_style))
    elements.append(Spacer(1, 15))
    
    info_data = [
        ['Investor Name:', data.get('investorName', 'N/A')],
        ['Email:', data.get('investorEmail', 'N/A')],
        ['Investment Amount:', f"${data.get('investmentAmount', 0):,.2f}"],
        ['Agreement Date:', datetime.now().strftime('%B %d, %Y')]
    ]
    
    info_table = Table(info_data, colWidths=[2*inch, 4*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Terms and Conditions", heading_style))
    
    content = data.get('content', '')
    paragraphs = content.split('\n')
    for para in paragraphs:
        if para.strip():
            elements.append(Paragraph(para.strip(), body_style))
    
    elements.append(Spacer(1, 30))
    
    elements.append(Paragraph("Acknowledgment", heading_style))
    elements.append(Paragraph(
        f"I, {data.get('investorName', 'the undersigned')}, acknowledge that I have read, understood, "
        "and agree to be bound by all terms and conditions set forth in this Investment Agreement. "
        "I confirm that I am investing the amount specified above of my own free will and understand "
        "the risks involved with this investment.",
        legal_style
    ))
    
    elements.append(Spacer(1, 30))
    
    elements.append(Paragraph("Digital Signature", heading_style))
    
    signature_data = data.get('signatureData', '')
    if signature_data and signature_data.startswith('data:image/'):
        try:
            header, encoded = signature_data.split(',', 1)
            sig_bytes = base64.b64decode(encoded)
            sig_image = Image(BytesIO(sig_bytes), width=2.5*inch, height=1*inch)
            elements.append(sig_image)
        except Exception as e:
            elements.append(Paragraph("[Signature could not be rendered]", body_style))
    else:
        elements.append(Paragraph("[No signature provided]", body_style))
    
    elements.append(Spacer(1, 10))
    
    signed_date = data.get('signedDate', datetime.now().isoformat())
    try:
        dt = datetime.fromisoformat(signed_date.replace('Z', '+00:00'))
        formatted_date = dt.strftime('%B %d, %Y at %I:%M %p')
    except:
        formatted_date = signed_date
    
    sig_details = [
        ['Signed by:', data.get('investorName', 'N/A')],
        ['Date Signed:', formatted_date],
        ['IP Address:', 'Recorded on server'],
    ]
    
    sig_table = Table(sig_details, colWidths=[1.5*inch, 4*inch])
    sig_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#444444')),
    ]))
    elements.append(sig_table)
    
    elements.append(Spacer(1, 40))
    
    elements.append(Paragraph(
        "This document was electronically signed and is legally binding. "
        "A copy has been stored securely for your records.",
        legal_style
    ))
    
    doc.build(elements)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: generate_signed_agreement.py '<input_json_path>' '<output_path>'")
        sys.exit(1)
    
    try:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
        
        with open(input_path, 'r') as f:
            data = json.load(f)
        
        generate_signed_agreement(data, output_path)
        print(f"Signed agreement generated: {output_path}")
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        sys.exit(1)
    except FileNotFoundError as e:
        print(f"Input file not found: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
