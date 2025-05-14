// src/components/character/steps/XpTriggerViewer.jsx
import React from 'react';

export default function XpTriggerViewer() {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">XP Triggers</h3>
      <p className="text-gray-600">
        These are the ways your character will earn experience points during play.
      </p>
      
      <div className="mt-4 bg-gray-50 p-4 rounded border">
        <h4 className="font-semibold mb-2">You earn XP when you:</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>Make desperate rolls (mark 1 XP in the attribute for the action)</li>
          <li>Express your character's core nature, beliefs, and drives</li>
          <li>Engage with your background and heritage in meaningful ways</li>
          <li>Take notable risks that put your character in genuine danger</li>
        </ul>
        
        <div className="mt-4 bg-blue-50 p-3 rounded">
          <p className="font-medium">With 10 XP, you can either:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Go up a Coin Grade in one stat</li>
            <li>Take 2 action rating increases</li>
            <li>Convert 5 XP to 1 Heritage Point</li>
          </ul>
        </div>
      </div>
      
      <div className="mt-4 bg-yellow-50 p-3 rounded border">
        <h4 className="font-medium">Character Growth:</h4>
        <p className="mt-1 text-sm">
          XP is your character's opportunity for growth and improvement. Pay attention to the 
          triggers and incorporate them into your roleplaying to maximize your advancement.
        </p>
      </div>
    </div>
  );
}