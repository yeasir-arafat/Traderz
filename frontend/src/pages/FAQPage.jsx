import React, { useEffect, useState } from 'react';
import { HelpCircle, ChevronDown, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { faqAPI } from '../lib/api';

export default function FAQPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const data = await faqAPI.getAll();
        setFaqs(data?.faqs || []);
      } catch (error) {
        console.error('Failed to fetch FAQs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFaqs();
  }, []);
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="text-center mb-12">
        <HelpCircle className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h1 className="text-4xl font-heading font-bold mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-muted-foreground">
          Find answers to common questions about PlayTraderz
        </p>
      </div>
      
      {faqs.length > 0 ? (
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.id}
              value={faq.id}
              className="border border-border rounded-lg px-6"
            >
              <AccordionTrigger className="hover:no-underline py-4" data-testid={`faq-${index}`}>
                <span className="text-left font-medium">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div
                  className="prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: faq.answer_html }}
                />
                {faq.youtube_links?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {faq.youtube_links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm block"
                      >
                        Watch Video {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No FAQs available yet
        </div>
      )}
    </div>
  );
}
