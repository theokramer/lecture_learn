import React from 'react';
import { HiHome, HiQuestionMarkCircle, HiCog6Tooth } from 'react-icons/hi2';
import { HiLightBulb } from 'react-icons/hi2';
import { Link } from 'react-router-dom';

interface SidebarProps {
  activePage: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage }) => {
  const navItems = [
    { icon: HiHome, label: 'Home', page: 'home', path: '/home' },
    { icon: HiLightBulb, label: 'How to use', page: 'how-to-use', path: '/how-to-use' },
    { icon: HiQuestionMarkCircle, label: 'Support', page: 'support', path: '/support' },
    { icon: HiCog6Tooth, label: 'Settings', page: 'settings', path: '/settings' },
  ];

  return (
    <div className="w-64 bg-[#2a2a2a] min-h-screen p-6 flex flex-col">
      <div className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.page;
          
          const content = (
            <div
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-[#3a3a3a] text-white' 
                  : 'text-[#9ca3af] hover:bg-[#3a3a3a] hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </div>
          );

          if (item.path) {
            return (
              <Link key={item.page} to={item.path}>
                {content}
              </Link>
            );
          }

          return <div key={item.page}>{content}</div>;
        })}
      </div>
    </div>
  );
};
