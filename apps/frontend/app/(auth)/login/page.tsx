'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionHeading } from '@/components/common/section-heading';
import { handleClientError } from '@/lib/handle-client-error';
import { loginWithPassword, requestOtp, verifyOtp } from '@/services/auth';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [status, setStatus] = useState<string>('Authenticate to access the DraftMind owner console.');

  async function handlePasswordLogin() {
    try {
      setStatus('Signing in...');
      await loginWithPassword(password);
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Login failed.'));
    }
  }

  async function handleOtpRequest() {
    try {
      setStatus('Requesting OTP...');
      await requestOtp();
      setStatus('OTP sent through the Telegram management bot.');
    } catch (error) {
      setStatus(handleClientError(error, router, 'OTP request failed.'));
    }
  }

  async function handleOtpVerify() {
    try {
      setStatus('Verifying OTP...');
      await verifyOtp(otpCode);
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'OTP verification failed.'));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-12">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_0.95fr]">
        <section className="space-y-5">
          <SectionHeading
            eyebrow="Owner access"
            title="Login"
            description="Use the configured password or request a Telegram OTP from the management bot."
          />
          <p className="max-w-xl text-sm leading-7 text-muted-foreground">
            Browser access uses the configured owner authentication mode. Sessions use secure cookies and expire according to the configured runtime policy.
          </p>
        </section>
        <div className="space-y-4">
          <Card className="space-y-4">
            <h2 className="text-xl font-semibold">Password login</h2>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Owner password" />
            <Button onClick={() => void handlePasswordLogin()}>Sign in with password</Button>
          </Card>
          <Card className="space-y-4">
            <h2 className="text-xl font-semibold">Telegram OTP</h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void handleOtpRequest()}>Request OTP</Button>
              <Input value={otpCode} onChange={(event) => setOtpCode(event.target.value)} placeholder="6-digit OTP" className="max-w-[220px]" />
              <Button onClick={() => void handleOtpVerify()}>Verify OTP</Button>
            </div>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">{status}</p>
          </Card>
        </div>
      </div>
    </main>
  );
}
