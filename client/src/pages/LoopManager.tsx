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
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AddMemberForm = {
  firstName: string;
  lastName: string;
  email: string;
  context?: string;
};

const DEFAULT_REMINDER_SCHEDULE = [
  { day: 'Wednesday', time: '09:00' },
  { day: 'Friday', time: '17:00' },
  { day: 'Sunday', time: '17:00' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  [`${hour.toString().padStart(2, '0')}:00`, `${hour.toString().padStart(2, '0')}:30`]
).flat();

export default function LoopManager() {
  const { id } = useParams<{ id: string }>();
  const { loop, isLoading, updateLoop } = useLoop(parseInt(id));
  const { toast } = useToast();
  const form = useForm<AddMemberForm>();
  const [phone, setPhone] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [, setLocation] = useLocation();

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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email", { required: true })}
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
                        {update.mediaUrl && (
                          <img
                            src={update.mediaUrl}
                            alt="Update media"
                            className="mt-2 rounded-md max-w-sm"
                          />
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
              <h3 className="text-lg font-semibold mb-4">Newsletters</h3>
              {loop.newsletters?.length ? (
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
              ) : (
                <p className="text-muted-foreground">No newsletters yet.</p>
              )}
            </TabsContent>
            <TabsContent value="members" className="mt-4">
              <h3 className="text-lg font-semibold mb-4">Members</h3>
              {loop.members?.length ? (
                <div className="space-y-4">
                  {loop.members.map((member) => (
                    <Card key={member.id}>
                      <CardContent className="pt-4">
                        <p>{member.user?.firstName} {member.user?.lastName}</p>
                        {member.context && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {member.context}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No members yet.</p>
              )}
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <h3 className="text-lg font-semibold mb-4">Loop Settings</h3>
              <div className="space-y-6">
                <div>
                  <Label>Newsletter Frequency</Label>
                  <p className="text-muted-foreground">{loop.frequency}</p>
                </div>
                <div>
                  <Label>Newsletter Vibe</Label>
                  <p className="text-muted-foreground">{loop.vibe.join(", ")}</p>
                </div>
                {loop.context && (
                  <div>
                    <Label>Group Context</Label>
                    <p className="text-muted-foreground">{loop.context}</p>
                  </div>
                )}
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
  );
}