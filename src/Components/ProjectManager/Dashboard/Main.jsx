import React from 'react'
import StatsCard from '../Dashboard/StatsCard'
import ActiveProjects from '../Dashboard/ActiveProjects'
import TeamStatus from '../Dashboard/TeamStatus'
import QuickActions from '../Dashboard/QuickActions'

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
