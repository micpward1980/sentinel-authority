"""
Tasks router for Sentinel Authority API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging

from database import get_db, Task
from schemas import TaskCreate, TaskUpdate, TaskResponse, PaginatedResponse
from routers.auth import get_current_user, CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_tasks(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    assigned_to: Optional[UUID] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List tasks with pagination and filters."""
    
    query = select(Task)
    
    if current_user.role != "admin":
        query = query.where(Task.account_id == current_user.account_id)
    
    if status_filter:
        query = query.where(Task.status == status_filter)
    
    if priority:
        query = query.where(Task.priority == priority)
    
    if assigned_to:
        query = query.where(Task.assigned_to == assigned_to)
    
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()
    
    query = query.order_by(Task.due_at.asc().nullslast(), Task.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    return PaginatedResponse(
        items=[TaskResponse.model_validate(t) for t in tasks],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new task."""
    
    task = Task(
        account_id=current_user.account_id,
        title=task_data.title,
        description=task_data.description,
        task_type=task_data.task_type,
        priority=task_data.priority,
        system_id=task_data.system_id,
        conformance_record_id=task_data.conformance_record_id,
        assigned_to=task_data.assigned_to,
        due_at=task_data.due_at,
        created_by=current_user.user_id
    )
    
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get task by ID."""
    
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user.role != "admin" and current_user.account_id != task.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    task_data: TaskUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a task."""
    
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user.role != "admin" and current_user.account_id != task.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = task_data.model_dump(exclude_unset=True)
    
    # Handle completion
    if update_data.get("status") == "completed" and task.status != "completed":
        update_data["completed_at"] = datetime.utcnow()
        update_data["completed_by"] = current_user.user_id
    
    for field, value in update_data.items():
        setattr(task, field, value)
    
    await db.commit()
    await db.refresh(task)
    
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a task."""
    
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user.role != "admin" and current_user.account_id != task.account_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delete(task)
    await db.commit()
