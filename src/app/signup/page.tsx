
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Syringe, CheckCircle2, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { signup } from "./actions"
import { useUser } from "@/firebase/auth/use-user"

const formSchema = z.object({
  firstName: z.string().min(2, {
    message: "First name must be at least 2 characters.",
  }),
  lastName: z.string().min(2, {
    message: "Last name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function SignupPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { user: firebaseUser, isLoading: isAuthLoading } = useUser()
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);
  const [userInfo, setUserInfo] = React.useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  // Check if user is already logged in
  React.useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user');
      const storedCenter = localStorage.getItem('center');

      // If a user is already logged in, redirect them
      if (storedUser || firebaseUser || storedCenter) {
        try {
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUserInfo(parsedUser);
          }
          toast({
            variant: "destructive",
            title: "Already Logged In",
            description: "You are already logged in. Please log out first to create a new account.",
          });
          router.push('/');
          return;
        } catch (error) {
          console.error('Failed to parse user data:', error);
        }
      }

      setIsChecking(false);
    };

    if (!isAuthLoading) {
      checkAuth();
    }
  }, [firebaseUser, isAuthLoading, router, toast])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const result = await signup(values);
      if (result.success) {
        toast({
          title: "Account Created!",
          description: "Please check your email to verify your account before logging in.",
        })
        router.push('/login');
      } else {
        toast({
          variant: "destructive",
          title: "Signup Failed",
          description: result.error,
        })
      }
    } catch (error) {
       toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: "There was a problem with your request.",
        })
    } finally {
      setIsSubmitting(false);
    }
  }

  // Show loading state while checking authentication
  if (isChecking || isAuthLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Checking authentication...</p>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // If user is already logged in, show message (though they should be redirected)
  if (userInfo || firebaseUser) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold font-headline">Already Logged In</CardTitle>
              <CardDescription>You already have an account and are logged in.</CardDescription>
            </CardHeader>
            <CardContent>
              {userInfo && (
                <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-semibold">{userInfo.firstName} {userInfo.lastName}</p>
                      <p className="text-sm text-muted-foreground">{userInfo.email}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <Button onClick={() => router.push('/')} className="w-full">
                  Go to Home
                </Button>
                <Button onClick={() => router.push('/my-appointments')} variant="outline" className="w-full">
                  View My Appointments
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
                <Syringe className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold font-headline">Create an Account</CardTitle>
            <CardDescription>Join VaxSys to manage your vaccinations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@example.com" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </Form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
