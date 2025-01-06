import { useState } from "react";
import { useUser } from "../hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

type AuthFormData = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
};

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const form = useForm<AuthFormData>();
  const [phone, setPhone] = useState("");

  const onSubmit = async (data: AuthFormData) => {
    try {
      const formData = {
        ...data,
        phoneNumber: phone // Use the phone state instead of form data
      };

      const result = isLogin 
        ? await login(formData)
        : await register(formData);

      if (!result.ok) {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
        return;
      }

      setLocation("/");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? "Login" : "Sign Up"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "Welcome back! Please login to continue."
              : "Create an account to get started."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email", { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...form.register("password", { required: true })}
              />
            </div>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    {...form.register("firstName", { required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    {...form.register("lastName", { required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <PhoneInput
                    country={'us'}
                    value={phone}
                    onChange={setPhone}
                    containerClass="!w-full"
                    inputClass="!w-full !h-10 !py-2 !px-3 !text-base !bg-background !border-input hover:!bg-accent hover:!text-accent-foreground !rounded-md"
                    buttonClass="!bg-background !border-input hover:!bg-accent hover:!text-accent-foreground !rounded-l-md"
                    dropdownClass="!bg-background !text-foreground"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">
              {isLogin ? "Login" : "Sign Up"}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Login"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}