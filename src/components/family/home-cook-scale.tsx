'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, Utensils, ShoppingCart, Truck } from 'lucide-react';

export function HomeCookScale() {
  const [ratio, setRatio] = useState(80); // 80% home cooked

  const isHomeFocused = ratio >= 60;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ChefHat className="h-4 w-4" />
          Home Cook vs Outside Food
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Scale slider */}
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={ratio}
              onChange={(e) => setRatio(parseInt(e.target.value))}
              className="w-full h-2 bg-gradient-to-r from-orange-300 via-yellow-200 to-green-400 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #fb923c ${100 - ratio}%, #4ade80 ${100 - ratio}%)`,
              }}
            />
            <div className="flex justify-between mt-1">
              <div className="flex items-center gap-1 text-xs text-orange-600">
                <Truck className="h-3 w-3" />
                Outside Food
              </div>
              <div className="text-sm font-bold">
                <span className="text-green-700">{ratio}%</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="text-orange-600">{100 - ratio}%</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                Home Cooked
                <ChefHat className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className={`rounded-lg p-3 text-sm ${ratio >= 80 ? 'bg-green-50 text-green-800' : ratio >= 60 ? 'bg-yellow-50 text-yellow-800' : 'bg-orange-50 text-orange-800'}`}>
            {ratio >= 80 ? (
              <p>Great balance! Your plan focuses on home-cooked meals with groceries. This maximizes nutrition control and savings.</p>
            ) : ratio >= 60 ? (
              <p>Good start! Try increasing home cooking to 80% for better nutrition control. We recommend 80% home-cooked, 20% outside.</p>
            ) : (
              <p>High outside food ratio. Consider cooking more at home - it's healthier and cheaper. Target: 80% home-cooked.</p>
            )}
          </div>

          {/* What this means */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-green-600" />
                <p className="text-xs font-medium text-green-800">Home Cooked ({ratio}%)</p>
              </div>
              <ul className="text-xs text-green-700 space-y-1">
                <li>· {Math.round(ratio / 100 * 7 * 3)} meals/week from groceries</li>
                <li>· Full macro control</li>
                <li>· Grocery plan auto-generated</li>
                {isHomeFocused && <li>· Recipe suggestions active</li>}
              </ul>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Utensils className="h-4 w-4 text-orange-600" />
                <p className="text-xs font-medium text-orange-800">Outside ({100 - ratio}%)</p>
              </div>
              <ul className="text-xs text-orange-700 space-y-1">
                <li>· ~{Math.round((100 - ratio) / 100 * 7 * 3)} meals/week ordered</li>
                <li>· Healthier picks highlighted</li>
                <li>· Best offers tracked</li>
                <li>· Cheat meals managed</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
