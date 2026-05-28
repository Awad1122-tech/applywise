export default function Privacy() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", color: "#1a1a1a", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Last updated: 28 May 2026</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>1. What is ApplyWise?</h2>
      <p>ApplyWise is a job application tracker that helps you manage and monitor your job applications in one place. It can optionally connect to your Gmail account to automatically detect and import job-related emails.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>2. What data we collect</h2>
      <p>We collect the following information when you use ApplyWise:</p>
      <ul>
        <li>Your email address and password (hashed) when you register</li>
        <li>Job application data you add manually or import from Gmail</li>
        <li>Gmail email metadata (sender, subject, body) solely to extract job application information — only when you explicitly grant Gmail access</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>3. How we use your data</h2>
      <p>Your data is used exclusively to provide the ApplyWise service:</p>
      <ul>
        <li>To display and manage your job applications</li>
        <li>To detect duplicate applications</li>
        <li>To show statistics and analytics about your job search</li>
      </ul>
      <p>We do not sell, share, or use your data for advertising or any purpose beyond providing the service.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>4. Gmail access</h2>
      <p>If you choose to connect Gmail, ApplyWise requests read-only access to your inbox. We use this access only to scan for job-related emails and extract application data. We do not store your full emails — only the extracted company name, job title, and application status.</p>
      <p>You can revoke Gmail access at any time from your Google Account settings at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>5. Data storage</h2>
      <p>Your data is stored securely in a PostgreSQL database hosted on Supabase (EU region). Passwords are hashed and never stored in plain text.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>6. Data retention</h2>
      <p>Your data is retained for as long as your account is active. You can delete your account and all associated data by contacting us at the email below.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>7. Your rights</h2>
      <p>You have the right to access, correct, or delete your personal data at any time. To exercise these rights, contact us at <a href="mailto:awadpervez123@gmail.com">awadpervez123@gmail.com</a>.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>8. Changes to this policy</h2>
      <p>We may update this privacy policy from time to time. Changes will be posted on this page with an updated date.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>9. Contact</h2>
      <p>If you have any questions about this privacy policy, contact us at <a href="mailto:awadpervez123@gmail.com">awadpervez123@gmail.com</a>.</p>
    </div>
  )
}