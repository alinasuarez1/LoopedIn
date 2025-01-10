import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface LoopDetails {
  id: number;
  name: string;
  frequency: string;
  vibe: string[];
  context?: string;
  reminderSchedule: Array<{
    day: string;
    time: string;
  }>;
  creator: {
    firstName: string;
    lastName: string;
    email: string;
  };
  members: Array<{
    id: number;
    user: {
      firstName: string;
      lastName: string;
      email: string | null;
      phoneNumber: string;
    };
    context?: string;
  }>;
  updates: Array<{
    id: number;
    content: string;
    mediaUrls: string[];
    createdAt: string;
    user: {
      firstName: string;
      lastName: string;
    };
  }>;
  newsletters: Array<{
    id: number;
    content: string;
    sentAt: string;
  }>;
}

export default function AdminLoopDetails() {
  const { id } = useParams<{ id: string }>();
  
  const { data: loop, isLoading, error } = useQuery<LoopDetails>({
    queryKey: [`/api/admin/loops/${id}`],
    retry: false,
  });

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error.message || "Failed to load loop details"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !loop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{loop.name}</h1>
      </div>

      {/* Loop Info */}
      <Card>
        <CardHeader>
          <CardTitle>Loop Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="font-medium text-muted-foreground">Frequency</dt>
              <dd className="capitalize">{loop.frequency}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Admin</dt>
              <dd>{loop.creator.firstName} {loop.creator.lastName} ({loop.creator.email})</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Vibe Tags</dt>
              <dd>{loop.vibe.join(", ")}</dd>
            </div>
            {loop.context && (
              <div>
                <dt className="font-medium text-muted-foreground">Context</dt>
                <dd>{loop.context}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>{loop.members.length} total members</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loop.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    {member.user.firstName} {member.user.lastName}
                  </TableCell>
                  <TableCell>{member.user.email || "—"}</TableCell>
                  <TableCell>{member.user.phoneNumber}</TableCell>
                  <TableCell>{member.context || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Updates</CardTitle>
          <CardDescription>{loop.updates.length} total updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loop.updates.map((update) => (
            <Card key={update.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <p className="font-medium">
                    {update.user.firstName} {update.user.lastName}
                  </p>
                  <time className="text-sm text-muted-foreground">
                    {format(new Date(update.createdAt), "PPp")}
                  </time>
                </div>
              </CardHeader>
              <CardContent>
                <p>{update.content}</p>
                {update.mediaUrls.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {update.mediaUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View Media {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Newsletters */}
      <Card>
        <CardHeader>
          <CardTitle>Newsletters</CardTitle>
          <CardDescription>{loop.newsletters.length} total newsletters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loop.newsletters.map((newsletter) => (
            <Card key={newsletter.id}>
              <CardHeader>
                <time className="text-sm text-muted-foreground">
                  {format(new Date(newsletter.sentAt), "PPp")}
                </time>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {newsletter.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
