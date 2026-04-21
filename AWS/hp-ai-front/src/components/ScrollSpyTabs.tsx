"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
}

interface ScrollSpyTabsProps {
  tabs: TabItem[];
}

export function ScrollSpyTabs({ tabs }: ScrollSpyTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const handleScroll = () => {
      const sections = tabs.map((tab) => document.getElementById(tab.id));
      const scrollPosition = window.scrollY + 120;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveTab(tabs[i].id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [tabs]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" });
  };

  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => scrollToSection(tab.id)}
              className={cn(
                "border-b-2 py-4 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-200 dark:hover:text-gray-100",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
