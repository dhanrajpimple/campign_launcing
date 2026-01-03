import React, { useState } from 'react';
import { Upload, Mail, Eye, Send, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
const baseUrl = 'http://localhost:3000' 
interface Contact {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  email: string;
}

interface FieldMapping {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  email: string;
}

interface SendStatus {
  success: number;
  failed: number;
  total: number;
  complete?: boolean;
  error?: string;
}

export default function EmailCampaignManager() {
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    email: ''
  });
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);
  const [processingFile, setProcessingFile] = useState<boolean>(false);

  // Step 1: File Upload and Mapping
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setProcessingFile(true);
    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          alert('No data found in file');
          setProcessingFile(false);
          return;
        }

        // Get available fields from first row
        const fields = Object.keys(jsonData[0]);
        setAvailableFields(fields);

        // Auto-map fields if possible
        const autoMapping: FieldMapping = {
          firstName: '',
          lastName: '',
          phone: '',
          address: '',
          email: ''
        };
        
        fields.forEach(field => {
          const lower = field.toLowerCase().trim();
          if (lower.includes('first') && lower.includes('name')) autoMapping.firstName = field;
          else if (lower.includes('last') && lower.includes('name')) autoMapping.lastName = field;
          else if (lower.includes('email')) autoMapping.email = field;
          else if (lower.includes('phone')) autoMapping.phone = field;
          else if (lower.includes('address')) autoMapping.address = field;
        });
        
        setFieldMapping(autoMapping);

        // Store raw data temporarily
        (window as any).rawContactData = jsonData;
        setProcessingFile(false);
      } catch (error) {
        alert('Error reading file: ' + (error as Error).message);
        setProcessingFile(false);
      }
    };

    reader.onerror = () => {
      alert('Error reading file');
      setProcessingFile(false);
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const mapContacts = () => {
    if (!fieldMapping.email) {
      alert('Email field is required');
      return;
    }

    const rawData: any[] = (window as any).rawContactData || [];
    const mapped: Contact[] = rawData.map(row => ({
      firstName: fieldMapping.firstName ? row[fieldMapping.firstName] : '',
      lastName: fieldMapping.lastName ? row[fieldMapping.lastName] : '',
      phone: fieldMapping.phone ? row[fieldMapping.phone] : '',
      address: fieldMapping.address ? row[fieldMapping.address] : '',
      email: fieldMapping.email ? row[fieldMapping.email] : ''
    })).filter(contact => contact.email);

    if (mapped.length > 200) {
      alert('Maximum 200 contacts allowed. Only first 200 will be used.');
      setContacts(mapped.slice(0, 200));
    } else {
      setContacts(mapped);
    }

    setStep(2);
  };

  // Step 2: Email Template
  const handleTemplateNext = () => {
    if (!emailTemplate.trim()) {
      alert('Please enter an email template');
      return;
    }
    if (!subject.trim()) {
      alert('Please enter a subject');
      return;
    }
    setStep(3);
  };

  // Step 3: Review and Send
  const previewEmail = (contact: Contact): string => {
    let preview = emailTemplate;
    preview = preview.replace(/\{\{firstName\}\}/g, contact.firstName || '');
    preview = preview.replace(/\{\{lastName\}\}/g, contact.lastName || '');
    preview = preview.replace(/\{\{phone\}\}/g, contact.phone || '');
    preview = preview.replace(/\{\{address\}\}/g, contact.address || '');
    preview = preview.replace(/\{\{email\}\}/g, contact.email || '');
    return preview;
  };

  const handleSendEmails = async () => {
    setSending(true);
    setSendStatus({ success: 0, failed: 0, total: contacts.length });

    try {
      // Prepare email data matching the API format
      const users = contacts.map(contact => ({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        address: contact.address
      }));

      // Call the bulk email API using fetch
      const response = await fetch(`${baseUrl}/api/send-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: subject,
          htmlTemplate: emailTemplate,
          users: users
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Email sending result:', result);
      setSendStatus({ 
        success: contacts.length, 
        failed: 0, 
        total: contacts.length,
        complete: true
      });

    } catch (error) {
      setSendStatus({ 
        success: 0, 
        failed: contacts.length, 
        total: contacts.length,
        complete: true,
        error: (error as Error).message
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 border border-gray-100">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
              Email Campaign Manager
            </h1>
            <p className="text-gray-600 text-lg">Send personalized emails to your contacts</p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-10">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  step >= s 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200 scale-110' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > s ? <CheckCircle className="w-6 h-6" /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1.5 mx-2 rounded-full transition-all duration-300 ${
                    step > s 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600' 
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Upload and Map */}
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-gray-800">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                  </div>
                  Step 1: Upload Contacts
                </h2>
                <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 ${
                  processingFile 
                    ? 'border-emerald-400 bg-emerald-50' 
                    : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/30'
                }`}>
                  {processingFile ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                      <p className="text-emerald-700 font-medium">Processing file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-14 h-14 mx-auto text-gray-400 mb-4" />
                      <label className="cursor-pointer inline-block">
                        <span className="text-emerald-600 hover:text-emerald-700 font-semibold text-lg transition-colors">
                          Click to upload CSV or XLSX file
                        </span>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={processingFile}
                        />
                      </label>
                      {file && (
                        <div className="mt-4 p-3 bg-emerald-50 rounded-lg inline-block">
                          <p className="text-sm text-emerald-700 font-medium">
                            ✓ Selected: <span className="font-semibold">{file.name}</span>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {availableFields.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="text-xl font-semibold mb-6 text-gray-800">Map Fields</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {(Object.keys(fieldMapping) as Array<keyof FieldMapping>).map((field) => (
                      <div key={field}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 capitalize">
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                          {field === 'email' && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <select
                          value={fieldMapping[field]}
                          onChange={(e) => setFieldMapping({ ...fieldMapping, [field]: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white"
                        >
                          <option value="">-- Select Field --</option>
                          {availableFields.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={mapContacts}
                    className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3.5 rounded-lg hover:from-emerald-600 hover:to-teal-700 flex items-center gap-2 font-semibold shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 transition-all duration-300 transform hover:scale-105"
                  >
                    Continue <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Email Template */}
          {step === 2 && (
            <div className="space-y-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-gray-800">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Mail className="w-6 h-6 text-emerald-600" />
                </div>
                Step 2: Email Template
              </h2>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Body (HTML) <span className="text-red-500">*</span>
                </label>
                <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 font-medium">
                    Available variables: <span className="font-mono text-blue-900">{'{{firstName}}, {{lastName}}, {{phone}}, {{address}}, {{email}}'}</span>
                  </p>
                </div>
                <textarea
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                  placeholder="<h1>Hello {{firstName}},</h1><p>This is your personalized email...</p>"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg h-64 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-y"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 flex items-center gap-2 font-semibold transition-all duration-300 border border-gray-300"
                >
                  <ArrowLeft className="w-5 h-5" /> Back
                </button>
                <button
                  onClick={handleTemplateNext}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3 rounded-lg hover:from-emerald-600 hover:to-teal-700 flex items-center gap-2 font-semibold shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 transition-all duration-300 transform hover:scale-105"
                >
                  Review & Continue <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review and Send */}
          {step === 3 && (
            <div className="space-y-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-gray-800">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Eye className="w-6 h-6 text-emerald-600" />
                </div>
                Step 3: Review & Send
              </h2>

              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 md:p-8 space-y-6 border border-gray-200">
                <div className="bg-white rounded-lg p-5 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    Campaign Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <span className="text-gray-600 text-sm block mb-1">Total Recipients</span>
                      <span className="text-2xl font-bold text-emerald-700">{contacts.length}</span>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <span className="text-gray-600 text-sm block mb-1">Subject</span>
                      <span className="font-semibold text-gray-800 break-words">{subject}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-5 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">Email Preview (First Contact)</h3>
                  <div className="border-2 border-gray-200 rounded-lg p-5 bg-white">
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">
                        <strong className="text-gray-700">To:</strong> <span className="text-gray-900">{contacts[0]?.email}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong className="text-gray-700">Subject:</strong> <span className="text-gray-900">{subject}</span>
                      </div>
                    </div>
                    <div 
                      className="mt-4 prose prose-sm max-w-none text-gray-700"
                      dangerouslySetInnerHTML={{ __html: previewEmail(contacts[0]) }}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-5 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">Recipients List (First 5)</h3>
                  <div className="space-y-3">
                    {contacts.slice(0, 5).map((contact, idx) => (
                      <div key={idx} className="text-sm bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors">
                        <div className="font-semibold text-gray-700 mb-1">
                          <span className="text-emerald-600">Email:</span> {contact.email}
                        </div>
                        <div className="text-gray-600">
                          <span className="text-emerald-600">Name:</span> {contact.firstName} {contact.lastName}
                        </div>
                      </div>
                    ))}
                    {contacts.length > 5 && (
                      <p className="text-sm text-gray-600 font-medium text-center py-2">
                        ... and <span className="font-bold text-emerald-600">{contacts.length - 5}</span> more recipients
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {sending && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <div>
                      <span className="font-semibold text-blue-800 text-lg">Sending emails...</span>
                      <p className="text-sm text-blue-700 mt-1">Please wait while we process your campaign</p>
                    </div>
                  </div>
                </div>
              )}

              {sendStatus && sendStatus.complete && (
                <div className={`rounded-xl p-6 border-2 ${
                  sendStatus.error 
                    ? 'bg-red-50 border-red-300' 
                    : 'bg-emerald-50 border-emerald-300'
                }`}>
                  <div className="flex items-start gap-3">
                    {sendStatus.error ? (
                      <>
                        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-red-800 text-lg block">Error sending emails</span>
                          <p className="text-sm text-red-700 mt-2">{sendStatus.error}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-emerald-800 text-lg block">
                            Successfully sent {sendStatus.success} of {sendStatus.total} emails!
                          </span>
                          <p className="text-sm text-emerald-700 mt-2">Your campaign has been completed successfully.</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={sending}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 flex items-center gap-2 font-semibold transition-all duration-300 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-5 h-5" /> Back
                </button>
                <button
                  onClick={handleSendEmails}
                  disabled={sending || (sendStatus?.complete ?? false)}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3.5 rounded-lg hover:from-emerald-600 hover:to-teal-700 flex items-center gap-2 font-semibold shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                    </>
                  ) : sendStatus?.complete ? (
                    <>
                      <CheckCircle className="w-5 h-5" /> Sent Successfully
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" /> Confirm & Send Campaign
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}