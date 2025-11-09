
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import * as React from "react"
import { User, Calendar, ShieldCheck, Mail, RefreshCw, CheckCircle2 } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useToast } from "@/hooks/use-toast"
import { registerCitizen, getCitizenByEmail } from "./actions"
import { useRouter } from "next/navigation"

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 100 }, (_, i) => currentYear - i)
const months = Array.from({ length: 12 }, (_, i) => i + 1)
const days = Array.from({ length: 31 }, (_, i) => i + 1)

const formSchema = z.object({
  fullName: z.string().min(1, "Full Name is required"),
  day: z.string().min(1, "Day is required"),
  month: z.string().min(1, "Month is required"),
  year: z.string().min(1, "Year is required"),
  idType: z.enum(["nid", "passport", "birth_certificate"], {
    required_error: "You need to select an identification type.",
  }),
  idNumber: z.string().min(1, "ID Number is required"),
  contact: z.string().min(1, "Email or Mobile No. is required"),
  captcha: z.string().min(1, "Captcha is required"),
}).refine(data => {
    if (data.idType === "nid") {
        return /^\d{17}$/.test(data.idNumber);
    }
    return true;
}, {
    message: "National ID must be 17 digits.",
    path: ["idNumber"],
}).refine(data => {
    if (data.idType === "passport") {
        return /^\d{9}$/.test(data.idNumber);
    }
    return true;
}, {
    message: "Passport No. must be 9 digits.",
    path: ["idNumber"],
});


function generateCaptcha() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}


export default function CitizenRegistrationPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [captcha, setCaptcha] = React.useState("");
  const [citizenData, setCitizenData] = React.useState<any>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  // Get user email synchronously for form initialization
  const getInitialContact = () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        return parsedUser?.email || "";
      }
    } catch (error) {
      console.error('Failed to parse user data:', error);
  }
    return "";
  };

  // Initialize form first with static defaultValues
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      day: "",
      month: "",
      year: "",
      idType: "nid",
      idNumber: "",
      contact: getInitialContact(),
      captcha: "",
    },
  })

  React.useEffect(() => {
    setCaptcha(generateCaptcha());
    
    // Check if user is logged in and already registered
    const checkRegistration = async () => {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        setIsLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.email) {
          setUserEmail(parsedUser.email);
          // Update form contact field if it's not already set
          const currentContact = form.getValues('contact');
          if (!currentContact) {
            form.setValue('contact', parsedUser.email);
          }
          const result = await getCitizenByEmail(parsedUser.email);
          if (result.success && result.citizen) {
            setCitizenData(result.citizen);
          }
        }
      } catch (error) {
        console.error('Failed to parse user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkRegistration();
  }, [form]);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
  }

  const idType = form.watch("idType");

  const getIdPlaceholder = () => {
    switch (idType) {
        case "nid":
            return "Enter 17-digit NID number";
        case "passport":
            return "Enter 9-digit Passport number";
        case "birth_certificate":
            return "Enter Birth Certificate number";
        default:
            return "Enter ID Number";
    }
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.captcha.toUpperCase() !== captcha) {
        form.setError("captcha", { type: "manual", message: "Captcha does not match." });
        return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await registerCitizen(values);

      if (result.success) {
        toast({
            title: "Registration Successful!",
            description: `Citizen with ${values.idType.replace('_', ' ')}: ${values.idNumber} has been registered.`,
        });
        // Refresh citizen data
        if (userEmail) {
          const refreshResult = await getCitizenByEmail(userEmail);
          if (refreshResult.success && refreshResult.citizen) {
            setCitizenData(refreshResult.citizen);
          }
        }
        form.reset();
        refreshCaptcha();
      } else {
        toast({
            variant: "destructive",
            title: "Registration Failed",
            description: result.error || "An unknown error occurred.",
        });
      }
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Uh oh! Something went wrong.",
            description: "There was a problem with your request.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4 bg-primary/5">
          <Card className="w-full max-w-2xl shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Checking registration status...</p>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // If user is already registered, show their information
  if (citizenData) {
    const dateOfBirth = new Date(citizenData.dateOfBirth);
    const formattedDate = dateOfBirth.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const idTypeLabel = citizenData.idType === 'nid' ? 'National ID Card' : 
                       citizenData.idType === 'passport' ? 'Passport' : 
                       'Birth Certificate';

    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4 bg-primary/5">
          <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <CardTitle className="text-3xl font-bold font-headline">Citizen Registration Information</CardTitle>
              <CardDescription>
                You are already registered as a citizen. Here are your registration details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Full Name */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <User className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                    <p className="text-lg font-semibold">{citizenData.fullName}</p>
                  </div>
                </div>

                {/* Date of Birth */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                    <p className="text-lg font-semibold">{formattedDate}</p>
                  </div>
                </div>

                {/* Identification Type and Number */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Identification</p>
                    <p className="text-lg font-semibold">{idTypeLabel}</p>
                    <p className="text-base text-muted-foreground mt-1">{citizenData.idNumber}</p>
                  </div>
                </div>

                {/* Contact */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Mail className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Contact</p>
                    <p className="text-lg font-semibold">{citizenData.contact}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => router.push('/appointment/book')}
                  >
                    Schedule Appointment
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => router.push('/my-appointments')}
                  >
                    View My Appointments
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Show registration form if not registered
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4 bg-primary/5">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold font-headline">Citizen Vaccination Registration</CardTitle>
            <CardDescription>
              Please fill in the form below to register for vaccination.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Full Name */}
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input placeholder="Enter your full name" {...field} disabled={isSubmitting} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Date of Birth */}
                <FormField
                  control={form.control}
                  name="day"
                  render={() => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                            control={form.control}
                            name="day"
                            render={({ field }) => (
                                <FormItem>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                    <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="month"
                            render={({ field }) => (
                                <FormItem>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                    <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="year"
                            render={({ field }) => (
                                <FormItem>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                    <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                      </div>
                    </FormItem>
                  )}
                />
                
                {/* Identification Type */}
                <FormField
                  control={form.control}
                  name="idType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Identification Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-4"
                          disabled={isSubmitting}
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="nid" />
                            </FormControl>
                            <FormLabel className="font-normal">National ID Card</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="birth_certificate" />
                            </FormControl>
                            <FormLabel className="font-normal">Birth Certificate</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="passport" />
                            </FormControl>
                            <FormLabel className="font-normal">Passport</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* ID Number */}
                <FormField
                  control={form.control}
                  name="idNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identification Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input type="text" placeholder={getIdPlaceholder()} {...field} disabled={isSubmitting} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                 {/* Contact Info */}
                <FormField
                  control={form.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email or Mobile No.</FormLabel>
                      <FormControl>
                         <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input type="text" placeholder="e.g., user@example.com or 01xxxxxxxxx" {...field} disabled={isSubmitting} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Captcha */}
                <div className="space-y-2">
                    <FormLabel>Verification</FormLabel>
                    <div className="flex items-center gap-4">
                         <div className="w-48 h-12 flex items-center justify-center rounded-md bg-muted select-none">
                            <span className="text-2xl font-bold tracking-[.25em] text-muted-foreground" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'10\' viewBox=\'0 0 100 10\'%3E%3Cpath d=\'M0 5 Q 25 0, 50 5 T 100 5\' stroke=\'%23dddddd\' fill=\'none\'/%3E%3C/svg%3E")', textDecoration: 'line-through' }}>
                                {captcha}
                            </span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={refreshCaptcha} disabled={isSubmitting}>
                            <RefreshCw className="w-5 h-5" />
                            <span className="sr-only">Refresh CAPTCHA</span>
                        </Button>
                    </div>
                </div>
                <FormField
                  control={form.control}
                  name="captcha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enter the code above</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="Enter verification code" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? "Registering..." : "Submit Registration"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
