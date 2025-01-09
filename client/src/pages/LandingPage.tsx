import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "wouter";
import { MessageSquareText, Cpu, Users2 } from "lucide-react";

const faqs = [
  {
    question: "How does the sign up process work?",
    answer: "It only takes one person to get your group started! Simply log into our website, create a Loop, and add your group members along with their phone numbers. After that, LoopedIn takes care of everything—collecting updates and creating newsletters. It's that easy!"
  },
  {
    question: "How much does it cost?",
    answer: "It's completely free! There's no excuse to not sign up your group right now!"
  },
  {
    question: "What if I am in more than one loop?",
    answer: "You're covered! You can send updates to all your Loops at once or specify which Loop you're updating by including the Loop name in your text."
  },
  {
    question: "When can I send a text update?",
    answer: "Anytime! LoopedIn collects updates around the clock to include in your newsletter. The texts we send are just friendly reminders. 😊"
  },
  {
    question: "How many texts should I send?",
    answer: "As many as you want! Share updates, photos, or stories—the more you share, the richer and more engaging your newsletter will be."
  },
  {
    question: "What can I send?",
    answer: "Right now, LoopedIn supports texts and photos. Stay tuned—videos and voice memos are coming soon!"
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-orange-100/50">
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6 max-w-3xl mx-auto">
            Stay in the Loop—Effortlessly Collect Updates and News from your group!
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Keep your group connected with automated newsletters powered by SMS updates. No more scattered messages or missed updates.
          </p>
          <Link href="/auth">
            <Button size="lg" className="text-lg px-8">
              Get Started for Free!
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-primary/10">
                  <Users2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Simple Sign Up</h3>
              </div>
              <p className="text-muted-foreground">
                Create a loop and add members
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-primary/10">
                  <MessageSquareText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">SMS Updates</h3>
              </div>
              <p className="text-muted-foreground">
                Share updates via text message anytime, anywhere.
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-primary/10">
                  <Cpu className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Automated Newsletter</h3>
              </div>
              <p className="text-muted-foreground">
                Stay up to date with fun and engaging group newsletters!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="max-w-2xl mx-auto">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-base">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to keep your group connected?
          </h2>
          <Link href="/auth">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8"
            >
              Get Started for Free!
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}