import Link from "next/link";
import { Building2, CalendarDays, CheckCircle2, Clock3, Home, Landmark, Plus, ReceiptText } from "lucide-react";

const obligations = [
  {
    title: "1st Installment Property Tax",
    owner: "San Diego Rental",
    due: "Dec 10, 2026",
    amount: "$6,423.16",
    status: "Due Soon",
    statusClass: "bg-amber-100 text-amber-800",
  },
  {
    title: "California LLC Annual Tax",
    owner: "Example Holdings LLC",
    due: "Apr 15, 2027",
    amount: "$800.00",
    status: "Upcoming",
    statusClass: "bg-blue-100 text-blue-800",
  },
  {
    title: "2nd Installment Property Tax",
    owner: "Oakland Rental",
    due: "Apr 10, 2027",
    amount: "$4,850.00",
    status: "Upcoming",
    statusClass: "bg-blue-100 text-blue-800",
  },
];

const cards = [
  { label: "Due in 30 days", value: "1", icon: Clock3 },
  { label: "Due in 60 days", value: "2", icon: CalendarDays },
  { label: "Overdue", value: "0", icon: ReceiptText },
  { label: "Paid this year", value: "$14,225", icon: CheckCircle2 },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-gray-500">Property & Business</p>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Compliance Dashboard</h1>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-800">
            <Plus size={16} /> Add obligation
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                <Icon size={19} />
              </div>
              <div className="text-2xl font-semibold text-gray-950">{value}</div>
              <div className="mt-1 text-sm text-gray-500">{label}</div>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_0.7fr]">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="font-semibold text-gray-950">Upcoming obligations</h2>
                <p className="mt-1 text-sm text-gray-500">Your next property taxes, filings, fees, and renewals.</p>
              </div>
              <button className="text-sm font-medium text-gray-700 hover:text-gray-950">View all</button>
            </div>
            <div className="divide-y divide-gray-100">
              {obligations.map((item) => (
                <div key={`${item.title}-${item.owner}`} className="grid gap-4 px-6 py-5 md:grid-cols-[1.4fr_0.8fr_0.6fr_auto] md:items-center">
                  <div>
                    <p className="font-medium text-gray-950">{item.title}</p>
                    <p className="mt-1 text-sm text-gray-500">{item.owner}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Due</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{item.due}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{item.amount}</p>
                  </div>
                  <div className="flex items-center gap-3 md:justify-end">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.statusClass}`}>{item.status}</span>
                    <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-950">Quick add</h2>
              <div className="mt-4 grid gap-3">
                <Link href="/properties" className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:bg-gray-50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Home size={18} /></span>
                  <span><span className="block text-sm font-medium">Add property</span><span className="block text-xs text-gray-500">Address, APN, county and tax link</span></span>
                </Link>
                <button className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:bg-gray-50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Landmark size={18} /></span>
                  <span><span className="block text-sm font-medium">Add California LLC</span><span className="block text-xs text-gray-500">Auto-track $800 annual tax and LLC filing reviews</span></span>
                </button>
                <button className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:bg-gray-50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Building2 size={18} /></span>
                  <span><span className="block text-sm font-medium">Add other business</span><span className="block text-xs text-gray-500">Entity details and annual filings</span></span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white shadow-sm">
              <p className="text-sm font-medium text-gray-300">Reminder system</p>
              <h2 className="mt-2 text-xl font-semibold">Never miss a deadline.</h2>
              <p className="mt-2 text-sm leading-6 text-gray-300">Email reminders will be sent before each unpaid obligation. California LLCs can automatically track the $800 annual tax, Form 568 review, and any additional LLC fee review.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
