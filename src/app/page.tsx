import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-orange-50">
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-green-800">NutriPlan</h1>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-20 pb-32 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6">
          Plan meals together,<br />eat healthier as a couple
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Personalized nutrition plans for you and your partner. Smart grocery lists with price comparison across BigBasket, Blinkit, Zepto, Swiggy & more.
        </p>
        <div className="flex gap-4 justify-center mb-16">
          <Link href="/signup">
            <Button size="lg" className="text-lg px-8 py-6">Start Your Plan</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            {
              title: 'Personal Targets',
              desc: 'Calorie & macro goals tailored to each person based on weight, activity level, and health goals.',
            },
            {
              title: 'Smart Grocery Lists',
              desc: 'Auto-generated from your meal plan. Compare prices across BigBasket, Blinkit, Zepto, Swiggy Instamart & FirstClub.',
            },
            {
              title: 'Learn From Your History',
              desc: 'Import past orders from food & grocery apps. We find healthier alternatives that match your taste.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
