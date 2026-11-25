"use client";

import { paths } from "@stariva/config";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useSidebar,
} from "@stariva/ui";
import { IconKey, IconLogout, IconUserCircle } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { authClient } from "~/auth/client";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const initials = getInitials(user.name);

  const handleLogout = async () => {
    await authClient.signOut();
    router.push(paths.auth.login);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title={user.name}
            aria-label="Меню пользователя"
            className="flex size-9 items-center justify-center rounded-xl text-zinc-50 transition-colors hover:bg-white/10"
          />
        }
      >
        <span className="relative">
          <Avatar className="size-7 rounded-full">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-full text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="absolute right-0 bottom-0 size-2 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={8}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(paths.settings.profile)}>
            <IconUserCircle />
            Профиль
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(paths.settings.password)}
          >
            <IconKey />
            Пароль
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <IconLogout />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
