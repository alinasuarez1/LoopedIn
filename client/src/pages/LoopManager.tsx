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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type AddMemberForm = {
  firstName: string;
  lastName: string;
  email?: string;
  context?: string;
};

type LoopSettingsForm = {
  context?: string;
  vibe: string[];
};

const DEFAULT_REMINDER_SCHEDULE = [
  { day: 'Wednesday', time: '09:00' },
  { day: 'Friday', time: '17:00' },
  { day: 'Sunday', time: '17:00' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Generate time options in 5-minute intervals
const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, index) => {
  const hour = Math.floor(index / 12);
  const minute = (index % 12) * 5;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const vibeOptions = [
  { label: "Fun", value: "fun" },
  { label: "Casual", value: "casual" },
  { label: "Funny", value: "funny" },
  { label: "Formal", value: "formal" },
  { label: "Deep", value: "deep" },
];

export default function LoopManager() {
  const { id } = useParams<{ id: string }>();
  const { loop, isLoading, updateLoop, deleteLoop } = useLoop(parseInt(id));
  const { toast } = useToast();
  const form = useForm<AddMemberForm>();
  const [phone, setPhone] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const queryClient = useQueryClient();
  const settingsForm = useForm<LoopSettingsForm>({
    defaultValues: {
      context: loop?.context,
      vibe: loop?.vibe || [],
    },
  });

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

  if (isLoading || !loop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
    <div className="min-h-screen bg-orange-100/50">
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
            <Tabs defaultValue="updates">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="updates">Updates</TabsTrigger>
                <TabsTrigger value="newsletters">Newsletters</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="updates" className="mt-4">
                <h3 className="text-lg font-semibold mb-4">Recent Updates</h3>
                {loop.updates?.length ? (
                  <div className="space-y-4">
                    {loop.updates.map((update) => (
                      <Card key={update.id}>
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">
                            {new Date(update.createdAt!).toLocaleString()}
                          </p>
                          <p className="mt-2">{update.content}</p>
                          {update.mediaUrls && update.mediaUrls.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {update.mediaUrls.map((url, index) => (
                                <div key={index} className="relative aspect-square">
                                  <img
                                    src={url}
                                    alt={`Update media ${index + 1}`}
                                    className="rounded-md w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      console.error('Failed to load image:', url);
                                      const target = e.target as HTMLImageElement;
                                      target.onerror = null; // Prevent infinite loop
                                      target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='9' cy='9' r='2'%3E%3C/circle%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'%3E%3C/path%3E%3C/svg%3E";
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No updates yet.</p>
                )}
              </TabsContent>
              <TabsContent value="newsletters" className="mt-4">
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Newsletters</h3>
                  </div>
                  <div className="w-full">
                    {(() => {
                      // Calculate the next newsletter date based on either creation date or last newsletter
                      const lastNewsletter = loop.newsletters?.[loop.newsletters.length - 1];
                      const baseDate = lastNewsletter
                        ? new Date(lastNewsletter.sentAt!)
                        : new Date(loop.createdAt!);
                      const nextNewsletterDate = new Date(baseDate);

                      // Add days based on frequency
                      if (loop.frequency === 'biweekly') {
                        nextNewsletterDate.setDate(nextNewsletterDate.getDate() + 14);
                      } else if (loop.frequency === 'monthly') {
                        nextNewsletterDate.setMonth(nextNewsletterDate.getMonth() + 1);
                      }

                      const now = new Date();
                      const diffTime = Math.abs(nextNewsletterDate.getTime() - now.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      const isOverdue = nextNewsletterDate < now;

                      return (
                        <Card className={isOverdue ? "border-destructive" : "border-primary"}>
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">
                                  {lastNewsletter ? "Next Newsletter" : "First Newsletter"}
                                </p>
                                <p className="text-2xl font-bold mt-1">
                                  {isOverdue ? (
                                    <span className="text-destructive">
                                      Overdue by {diffDays} days
                                    </span>
                                  ) : (
                                    <span>
                                      In {diffDays} days
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {`Scheduled for ${nextNewsletterDate.toLocaleDateString()}`}
                                </p>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {`${loop.frequency} newsletter`}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div>
                </div>

                {loop.newsletters?.length > 0 && (
                  <div className="space-y-4">
                    {loop.newsletters.map((newsletter) => (
                      <Card key={newsletter.id}>
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">
                            Sent on {new Date(newsletter.sentAt!).toLocaleString()}
                          </p>
                          <div className="mt-2 prose" dangerouslySetInnerHTML={{ __html: newsletter.content }} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="members" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Members</h3>
                  <AddMemberDialog />
                </div>
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
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/loops/${id}/members/${member.id}`, {
                                    method: 'DELETE',
                                    credentials: 'include',
                                  });

                                  if (!response.ok) {
                                    throw new Error(await response.text());
                                  }

                                  // Invalidate and refetch loop data
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
                            </Button>
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
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Loop Settings</h3>
                  <div className="flex gap-2">
                    {isEditingSettings ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingSettings(false);
                            settingsForm.reset({
                              context: loop.context,
                              vibe: loop.vibe,
                            });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={settingsForm.handleSubmit(async (data) => {
                            try {
                              await updateLoop({
                                ...loop,
                                context: data.context,
                                vibe: data.vibe,
                              });
                              toast({
                                title: "Success",
                                description: "Loop settings updated successfully!",
                              });
                              setIsEditingSettings(false);
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: error instanceof Error ? error.message : "Failed to update loop settings",
                                variant: "destructive",
                              });
                            }
                          })}
                        >
                          Save Changes
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setIsEditingSettings(true)}>
                        Edit Settings
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">Delete Loop</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the loop
                            and remove all data associated with it.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                await deleteLoop(loop.id);
                                toast({
                                  title: "Success",
                                  description: "Loop deleted successfully",
                                });
                                setLocation('/');
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: error instanceof Error ? error.message : "Failed to delete loop",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <Label>Newsletter Frequency</Label>
                    <p className="text-muted-foreground">{loop.frequency}</p>
                  </div>
                  <div>
                    <Label>Newsletter Vibe</Label>
                    {isEditingSettings ? (
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        {vibeOptions.map((vibe) => (
                          <div key={vibe.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`vibe-${vibe.value}`}
                              checked={settingsForm.watch("vibe").includes(vibe.value)}
                              onCheckedChange={(checked) => {
                                const currentVibes = settingsForm.watch("vibe");
                                settingsForm.setValue(
                                  "vibe",
                                  checked
                                    ? [...currentVibes, vibe.value]
                                    : currentVibes.filter(v => v !== vibe.value)
                                );
                              }}
                            />
                            <label
                              htmlFor={`vibe-${vibe.value}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {vibe.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{loop.vibe.join(", ")}</p>
                    )}
                  </div>
                  <div>
                    <Label>Group Context</Label>
                    {isEditingSettings ? (
                      <Input
                        className="mt-2"
                        {...settingsForm.register("context")}
                        placeholder="What brings your group together?"
                      />
                    ) : (
                      <p className="text-muted-foreground">{loop.context || "No context provided"}</p>
                    )}
                  </div>
                  <div>
                    <Label>Reminder Schedule</Label>
                    <div className="mt-2 space-y-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const reminderForDay = loop.reminderSchedule.find(r => r.day === day);
                        return (
                          <div key={day} className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2 min-w-[200px]">
                              <Checkbox
                                id={day}
                                checked={!!reminderForDay}
                                onCheckedChange={async (checked) => {
                                  try {
                                    const newSchedule = checked
                                      ? [...loop.reminderSchedule, { day, time: '09:00' }]
                                      : loop.reminderSchedule.filter(r => r.day !== day);

                                    await updateLoop({
                                      reminderSchedule: newSchedule,
                                    });

                                    toast({
                                      title: "Success",
                                      description: "Reminder schedule updated successfully!",
                                    });
                                  } catch (error) {
                                    toast({
                                      title: "Error",
                                      description: error instanceof Error ? error.message : "Failed to update reminder schedule",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              />
                              <Label htmlFor={day}>{day}</Label>
                            </div>
                            {reminderForDay && (
                              <Select
                                value={reminderForDay.time}
                                onValueChange={async (newTime) => {
                                  try {
                                    const newSchedule = loop.reminderSchedule.map(r =>
                                      r.day === day ? { ...r, time: newTime } : r
                                    );

                                    await updateLoop({
                                      reminderSchedule: newSchedule,
                                    });

                                    toast({
                                      title: "Success",
                                      description: "Reminder time updated successfully!",
                                    });
                                  } catch (error) {
                                    toast({
                                      title: "Error",
                                      description: error instanceof Error ? error.message : "Failed to update reminder time",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem key={time} value={time}>
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Select the days and times when members will receive SMS reminders to share their updates.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}