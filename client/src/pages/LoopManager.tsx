import { useQueryClient } from "@tanstack/react-query";
import { useState } from 'react';
import { useLoop } from "../hooks/use-loops";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AddMemberForm = {
  firstName: string;
  lastName: string;
  email?: string;
  context?: string;
};

export default function LoopManager() {
  const { id } = useParams<{ id: string }>();
  const { loop, isLoading, updateLoop } = useLoop(parseInt(id));
  const { toast } = useToast();
  const form = useForm<AddMemberForm>();
  const [phone, setPhone] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  if (isLoading || !loop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const onSubmit = async (data: AddMemberForm) => {
    try {
      const response = await fetch(`/api/loops/${id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          phoneNumber: phone,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Invalidate and refetch loop data
      await queryClient.invalidateQueries({ queryKey: [`/api/loops/${id}`] });

      toast({
        title: "Success",
        description: "Member added successfully!",
      });

      form.reset();
      setPhone("");
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add member",
        variant: "destructive",
      });
    }
  };

  const AddMemberDialog = () => (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <Label htmlFor="email">Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <PhoneInput
              country={'us'}
              value={phone}
              onChange={setPhone}
              containerClass="!w-full"
              inputClass="!w-full !h-10 !py-2 !pl-12 !pr-3 !text-base !bg-background !border-input hover:!bg-accent hover:!text-accent-foreground !rounded-md"
              buttonClass="!absolute !left-0 !h-full !bg-background !border-input hover:!bg-accent hover:!text-accent-foreground !rounded-l-md"
              dropdownClass="!bg-background !text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="context">Member Context (Optional)</Label>
            <Input
              id="context"
              {...form.register("context")}
              placeholder="e.g., Family member, Team lead, etc."
            />
          </div>
          <Button type="submit" className="w-full">
            Add Member
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="container mx-auto p-4">
      <Button 
        variant="ghost" 
        className="mb-4" 
        onClick={() => setLocation('/')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{loop.name}</CardTitle>
            <CardDescription>
              Created on {new Date(loop.createdAt!).toLocaleDateString()}
            </CardDescription>
          </div>
          <AddMemberDialog />
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="members">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="mt-4">
              <h3 className="text-lg font-semibold mb-4">Members</h3>
              {loop.members?.length ? (
                <div className="space-y-4">
                  {loop.members.map((member) => (
                    <Card key={member.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <p className="font-medium">
                              {member.user?.firstName} {member.user?.lastName}
                            </p>
                            {member.context && (
                              <p className="text-sm text-muted-foreground">
                                {member.context}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {member.user?.phoneNumber}
                            </p>
                            {member.user?.email && (
                              <p className="text-sm text-muted-foreground">
                                {member.user.email}
                              </p>
                            )}
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove this member from the loop? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/loops/${id}/members/${member.id}`, {
                                        method: 'DELETE',
                                        credentials: 'include',
                                      });

                                      if (!response.ok) {
                                        throw new Error(await response.text());
                                      }

                                      // Refetch the loop data to update the member list
                                      await queryClient.invalidateQueries({ queryKey: [`/api/loops/${id}`] });

                                      toast({
                                        title: "Success",
                                        description: "Member removed successfully",
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "Error",
                                        description: error instanceof Error ? error.message : "Failed to remove member",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No members yet.</p>
              )}
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Loop Settings</h3>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <p className="text-muted-foreground">{loop.name}</p>
                </div>
                <div className="space-y-2">
                  <Label>Created</Label>
                  <p className="text-muted-foreground">
                    {new Date(loop.createdAt!).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}