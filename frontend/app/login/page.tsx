'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { FcGoogle } from 'react-icons/fc';
import Image from 'next/image';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-white py-8 px-6 shadow-xl rounded-lg">
      {error && (
        <div className="mb-4 p-3 bg-status-error/10 border border-status-error/20 rounded-md">
          <p className="text-sm text-status-error">
            {error === 'OAuthSignin' && 'Error signing in with Google'}
            {error === 'OAuthCallback' && 'Error during authentication callback'}
            {error === 'OAuthCreateAccount' && 'Error creating account'}
            {error === 'EmailCreateAccount' && 'Error creating account'}
            {error === 'Callback' && 'Error during callback'}
            {error === 'Default' && 'An error occurred during sign in'}
          </p>
        </div>
      )}

      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-wnba-gray-300 rounded-md shadow-sm text-sm font-medium text-wnba-gray-700 bg-white hover:bg-wnba-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wnba-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-wnba-gray-300 border-t-wnba-orange rounded-full animate-spin" />
        ) : (
          <FcGoogle className="w-5 h-5" />
        )}
        <span>Continue with Google</span>
      </button>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-wnba-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-wnba-gray-500">
              By signing in, you agree to our Terms and Privacy Policy
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="mt-8 bg-white py-8 px-6 shadow-xl rounded-lg">
      <div className="animate-pulse">
        <div className="w-full h-12 bg-wnba-gray-200 rounded-md"></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-wnba-orange/10 to-wnba-navy/10">
      <div className="max-w-md w-full space-y-8 px-4">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-gradient-wnba rounded-full flex items-center justify-center">
              <span className="text-white text-3xl font-bold">WFA</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-wnba-gray-900">
            Welcome to WNBA Fantasy Analytics
          </h2>
          <p className="mt-2 text-wnba-gray-600">
            Sign in to access advanced analytics and insights
          </p>
        </div>

        <Suspense fallback={<LoadingFallback />}>
          <LoginForm />
        </Suspense>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-6 text-sm text-wnba-gray-600">
            <a href="/about" className="hover:text-wnba-orange">
              About
            </a>
            <a href="/pricing" className="hover:text-wnba-orange">
              Pricing
            </a>
            <a href="/help" className="hover:text-wnba-orange">
              Help
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}