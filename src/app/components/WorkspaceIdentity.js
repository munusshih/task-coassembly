'use client';
import { createContext, useContext } from 'react';
export const WorkspaceIdentityContext = createContext(null);
export const useWorkspaceIdentity = () => useContext(WorkspaceIdentityContext);
