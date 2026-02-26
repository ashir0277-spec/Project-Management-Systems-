import React from 'react'
import StatsCard from './StatsCard'
import ActiveProjects from './ActiveProjects'
import TeamStatus from './TeamStatus'
import QuickActions from './QuickActions'

const Main = () => {
  return (
    <>
     <div className=''>
        <StatsCard/>
        <div className='flex gap-4'>
         <ActiveProjects/>
        <TeamStatus/>
   </div>
         <QuickActions/>

    </div> 
    </>
  )
}

export default Main
