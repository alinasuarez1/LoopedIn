import { useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
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
import { Loader2, Plus, ArrowLeft, Trash2 } from "lucide-react";
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
  phoneNumber: string;
};

type LoopSettingsForm = {
  context?: string;
  vibe: string[];
};

const AddMemberDialog = ({ isOpen, onOpenChange, onSubmit }: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddMemberForm) => Promise<void>;
}) => {
  const form = useForm<AddMemberForm>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      context: '',
      phoneNumber: ''
    }
  });

  const onPhoneChange = useCallback((phone: string) => {
    form.setValue('phoneNumber', phone, { 
      shouldTouch: true,
      shouldDirty: true,
      shouldValidate: false 
    });
  }, [form]);

  const handleSubmit = useCallback(async (data: AddMemberForm) => {
    await onSubmit(data);
    form.reset();
  }, [onSubmit, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <PhoneInput
              country={'us'}
              value={form.watch('phoneNumber')}
              onChange={onPhoneChange}
              containerClass="!w-full"
              inputClass="!w-full !h-10 !py-2 !pl-12 !pr-3 !text-base !bg-background !border-input hover:!bg-accent hover:!text-accent-foreground !rounded-md"
              buttonClass="!absolute !left-0 !h-full !bg-background !border-input hover:!bg-accent hover:!text-accent-foreground !rounded-l-md"
              dropdownClass="!bg-background !text-foreground"
              enableSearch
              disableSearchIcon
              searchClass="!bg-background !text-foreground"
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
};

export default function LoopManager() {
  const { id } = useParams<{ id: string }>();
  const { loop, isLoading, updateLoop, deleteLoop } = useLoop(parseInt(id));
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const queryClient = useQueryClient();

  const settingsForm = useForm<LoopSettingsForm>({
    defaultValues: {
      context: loop?.context ?? '',
      vibe: loop?.vibe || [],
    }
  });

  const onSubmit = useCallback(async (data: AddMemberForm) => {
    try {
      const response = await fetch(`/api/loops/${id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({ queryKey: [`/api/loops/${id}`] });

      toast({
        title: "Success",
        description: "Member added successfully!",
      });

      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add member",
        variant: "destructive",
      });
    }
  }, [id, queryClient, toast, setIsDialogOpen]);

  const handleDeleteLoop = useCallback(async () => {
    try {
      await deleteLoop();
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
  }, [deleteLoop, toast, setLocation]);

  if (isLoading || !loop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <AddMemberDialog 
              isOpen={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              onSubmit={onSubmit}
            />
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="members">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="updates">Updates</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* Members Tab */}
              <TabsContent value="members" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Members</h3>
                  <AddMemberDialog 
                    isOpen={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onSubmit={onSubmit}
                  />
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently remove this member from the loop.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/loops/${id}/members/${member.id}`, {
                                          method: 'DELETE',
                                          credentials: 'include',
                                        });
                                        if (!response.ok) {
                                          throw new Error(await response.text());
                                        }
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
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
              <TabsContent value="updates" className="mt-4">
                <h3 className="text-lg font-semibold mb-4">Recent Updates</h3>
                {loop.updates?.length ? (
                  <div className="space-y-4">
                    {loop.updates.map((update) => (
                      <Card key={update.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <p className="text-sm text-muted-foreground">
                              {new Date(update.createdAt!).toLocaleString()}
                            </p>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Update?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete this update and any associated media.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/loops/${id}/updates/${update.id}`, {
                                          method: 'DELETE',
                                          credentials: 'include',
                                        });
                                        if (!response.ok) {
                                          throw new Error(await response.text());
                                        }
                                        await queryClient.invalidateQueries({ queryKey: [`/api/loops/${id}`] });
                                        toast({
                                          title: "Success",
                                          description: "Update deleted successfully",
                                        });
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: error instanceof Error ? error.message : "Failed to delete update",
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
                                      target.onerror = null; 
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
                            onClick={handleDeleteLoop}
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

const vibeOptions = [
  { label: "Fun", value: "fun" },
  { label: "Casual", value: "casual" },
  { label: "Funny", value: "funny" },
  { label: "Formal", value: "formal" },
  { label: "Deep", value: "deep" },
];

const DEFAULT_REMINDER_SCHEDULE = [
  { day: 'Wednesday', time: '09:00' },
  { day: 'Friday', time: '17:00' },
  { day: 'Sunday', time: '17:00' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, index) => {
  const hour = Math.floor(index / 12);
  const minute = (index % 12) * 5;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});