import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "wouter";

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
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
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
      </section>

      {/* Features Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">SMS Updates</h3>
              <p className="text-muted-foreground">
                Share updates via text message anytime, anywhere. It's that simple!
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">AI Newsletters</h3>
              <p className="text-muted-foreground">
                Automatically generated newsletters that capture everyone's updates in a beautiful format.
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Smart Reminders</h3>
              <p className="text-muted-foreground">
                Customizable reminder schedule to keep everyone engaged and sharing.
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
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
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
